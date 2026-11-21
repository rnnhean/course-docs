# AI Security Bootcamp Part1：护栏 / 网关 / 可观测（P007–P008）

> 本段课程聚焦 DeepEvals 框架中的 **Generative Evals（GEval，生成式评估）**：先看官方 Streamlit 演示理解「步骤生成 → 提示词生成 → 打分 → 归一化」四步流程，再在 Jupyter Notebook 里用 `deepeval` 从零实现两个自定义 GEval 指标（correctness 与 professional tone），最后补上 rubric（评分区间）的写法。下面按「能照着跑起来」的标准写。

---

## 1. 这一节做什么

这两集（P007、P008）是一组「先讲原理、再写代码」的连体内容，目标只有一个：**让你自己动手跑通一个 GEval 评估**。

具体拆成四件事：

1. **看懂 GEval 的内部流程**。讲师用一张流程图把 GEval 拆成四步：步骤生成（step generation）→ 提示词生成（prompt generation）→ 打分（scoring）→ 归一化（normalization）。其中「步骤生成」有两条路：你自己写 evaluation steps，或者你只写一段自然语言 criteria，让 LLM 自己拆步骤。
2. **跑一遍官方 Streamlit 演示**。讲师给了一个「bring your own key」的课程配套 Streamlit 应用，接 Groq 的 API key，可以在网页上直接切换 Generative Evals / DAG / QAG 三个标签页、切换不同 topic（比如 RAG evals），实时看到 trace。
3. **在 Notebook 里从零实现**。建 `requirements.txt`、用 `uv` 建虚拟环境、装依赖、建 `notebook.ipynb`、设 API key、写两个测试用例、初始化 judge 模型（Groq 上的 `llama` 系列，通过 `deepeval.models` 里的 `LocalModel` 接入）、定义两个 GEval 指标、跑 `evaluate()` 拿到结果。
4. **补 rubric**。讲师演示了如何用 `Rubric` 把 0–10 分切成 0–2 / 3–5 / 6–8 / 9–10 四段，每段写清楚「什么情况算这一段」，避免 LLM 打分往中间挤（middle clustering）。

学完你应该能回答：GEval 什么时候用（主观、开放式评估：答案正确性、连贯性、质量、语气、安全性），什么时候别用（rubric 不能太复杂）。

---

## 2. 讲师原话

> "在上一期视频里我们已经大致讲过 GEval、DAG、QAG 了，这一期我们要更深入地钻进 GEval 内部，看清楚它到底是怎么工作的、里面的逻辑是什么、怎么真正实现这种生成式评估指标，以及它什么时候有用、什么时候没用。"
> —— p007 [00:00]

> "这个 Streamlit 应用相当于你的 DeepEval 模块伴侣，是一个 bring your own key 的伴侣。你可以去 groq.com——它是一个推理服务商——用 API key 去调用别的 LLM。"
> —— p007 [01:23]

> "为什么我给了两个 API key？因为这样可以和速率限制对抗。如果你用的是 Groq 的免费额度，在做评估的过程中一定会撞上速率限制。所以你可以注册一个账号拿一个 key，再注册另一个账号拿另一个 key，两个都填进来。"
> —— p007 [01:50]

> "测试用例里包含 input、expected output 和 actual output。这里已经预填了一个样例测试用例，你当然可以随时改。"
> —— p007 [04:40]

> "这个 GEval 指标是一种自定义指标。所谓自定义，意思是这个指标是我们自己定义的。在 GEval 类型的指标里，有几样东西要描述：第一是指标名，所有指标都一样；第二是 criteria，LLM 的实际思维链推理就基于这个 criteria 进行。"
> —— p007 [05:08]

> "定义 criteria 有两种方式，都用自然语言写，但有区别。第一种是默认方式，你就是把 criteria 写成一段话、一组句子。第二种是 evaluation step，你直接给出评估步骤：第一步你要做这个，第二步你要做这个，第三步你要做这个。这些就是 LLM 在思维链推理时会执行的具体步骤。"
> —— p007 [05:36]

> "在 evaluation step 这种方式里，你对评估执行有更多控制权；而在简单的 criteria 方式里，你更依赖 LLM 自己去抽取评估步骤。"
> —— p007 [06:30]

> "我们拿这个测试用例来说：输入是『你们的退货政策是什么』，期望输出是『购买后 30 天内可以全额退款』，这是我们期望得到的输出；而 actual output 是我们 AI 应用实际执行后拿到的输出。"
> —— p007 [07:28]

> "这个指标说的是 correctness：给定 expected output，判断 actual output 在事实上是否正确。这是很通用的说法。但在 evaluation step 里，你可以看到我们是在逐步定义：第一，检查回复是否礼貌专业；第二，惩罚讽刺、粗鲁和轻蔑的语言；第三，奖励清晰、尊重、有礼貌的措辞，哪怕很简短。"
> —— p007 [08:21]

> "点 Run GEval 看实际 trace。你会看到分数是 0.8。但我们要重点看的是可观测性——来自逐步 trace 的信息，看实际发生了什么。这里我们没有段落式的 criteria，我们直接给了 evaluation step。"
> —— p007 [09:20]

> "如果我切到 auto chain of thought 这个 criteria 再跑一次，结果会不一样。因为现在 LLM 基于这段段落、基于它自己的理解，真的去想出了一些评估步骤。你能看到我们想要的 evaluation step 被推迟/变形了。"
> —— p007 [10:19]

> "LLM 说：把输入和期望输出对比、理解上下文并记录；用期望输出评估实际输出、找出差异；评估事实正确性、判断实际输出是否与期望输出对齐。然后我们拿到分数 2。为什么是 2？因为它在理由里说『实际输出提供了超出所需的信息』。所以你能看到这里控制力更弱。但你随时可以加一句输入：『不要因为多给了信息就扣分』。"
> —— p007 [10:47]

> "所以核心是：evaluation step 要么你直接给，要么你给一段自然语言段落作为 criteria，让评估步骤被自动识别出来。"
> —— p007 [11:16]

> "第一步是步骤生成。步骤生成要么来自分析你给的 criteria（那段自然语言段落），要么你自己直接给这些步骤。"
> —— p007 [11:43]

> "第二步是提示词生成。提示词生成是由 DeepEval 自己完成的。提示词创建时，测试用例数据、指标详情，这些东西都会进入 LLM 的上下文窗口——哪个 LLM？LLM-as-a-judge 的上下文窗口。然后完整的提示词被创建出来。你能看到评估提示词是基于第一步识别出的 evaluation step，加上来自测试用例的 input 和 actual output 构建的。"
> —— p007 [12:13]

> "基于这个评估提示词，我们把它交给 LLM-as-a-judge，judge 会给我们一个 1 到 5 之间的分数。这里 judge 的输出是 4。但我们不会直接消费这个 4，我们要消费的是 token 4 的概率。这就是 normalization 这一步。"
> —— p007 [13:08]

> "打分时 LLM 会说『我的答案是 4』，但如果你了解 LLM，它会吐出 logprob：这个 token 的概率是多少、那个 token 的概率是多少。我们基于这个来做归一化。"
> —— p007 [13:34]

> "举个例子：让 LLM 在 1 到 5 之间选一个分数。LLM 给出的概率是 token 4 概率 0.6、token 5 概率 0.3、token 3 概率 0.1。我们要做的是加权求和——把每个 token 的数值乘以它的概率。token 4 的数值是 4，就乘它的概率；token 5 的数值是 5，乘 0.3。这样得到加权和，再把它归约到归一化值。比如分数是在 1 到 10 之间给的，就把这个值除以 10。"
> —— p007 [14:02]

> "配置 Generative Evals 指标还有几样东西：你可以定义名字、criteria、evaluation parameters。evaluation parameter 是什么？就是测试用例里哪些值是被允许使用的。通过给出 single-turn parameters 的列表，你可以说我要最少这些、最少那些。"
> —— p007 [15:28]

> "还有一些更高级的自定义：rubric、strict mode、custom template。strict mode 就是说：不要给我概率输出，直接给我二值输出，1 或 0，1 表示完美，0 表示不行。custom template 是用来覆盖默认提示词模板的——我讲过提示词创建是基于 LangChain 里的一些模板，我们也可以自定义模板，这里同理。"
> —— p007 [15:58]

> "如果你去 DeepEval 官网文档，点进 GEval，你能看到所有这些细节都写在里面。你可以随时去搜这些文档。"
> —— p007 [17:22]

> "在 IDE 里我有一个空项目，里面只有一个 .excalidraw 文件——这个文件就是我的白板，我在里面给你解释一切。怎么在 IDE 里渲染它？首先把文件放进 IDE，然后去扩展商店搜 excalidraw，有一个官方扩展，装上之后会出现一个图标，点那个文件就能在 IDE 里打开白板。"
> —— p008 [00:28]

> "第二件事是创建一个 requirements.txt 来规范管理依赖。里面加 deepeval 框架就够了，对这个 GEval 演示来说这就够了。"
> —— p008 [01:23]

> "打开终端，跑任何 Python 项目第一件事是什么？创建虚拟环境。这里我用 uv 包管理器。先确认 uv 可用，然后用 uv venv 创建虚拟环境，复制激活命令激活它，再用 uv pip install -r requirements.txt 装依赖。你能看到 deepeval 依赖的所有包都跟着 deepeval 一起装上了。"
> —— p008 [02:20]

> "新建 notebook.ipynb，先选内核——选我们刚创建的虚拟环境。先跑个 print hello world 验证。它会提示你安装 kernel，我这里提示 no pip installer available，就手动装：用 uv 装 ipykernel。装好之后这个 cell 就能跑了。"
> —— p008 [03:46]

> "第一步是初始化。在此之前先设置 API key：import os 和 getpass，提示用户输入 API key。"
> —— p008 [05:35]

> "每个评估的基础是测试用例。我们建两个测试用例，输入都是『你们的退款政策是什么』，但 actual output 不同。第一个 actual output 是『很高兴为您服务，我们提供购买后 30 天内全额退款，无需任何理由』这类；第二个 actual output 很差，说『不退款，自己去看政策页』——这是很粗鲁的输出。所以一个是失败的测试用例，一个是通过的测试用例，expected output 两个用例相同。"
> —— p008 [06:29]

> "第二步是创建自然语言 criteria 并定义 rubric。先初始化 judge 模型：judge model 用的是 Groq 上的 local model。从 deepeval.models 里 import LocalModel，初始化它，这样我们就能用 Groq API key 去推理 Groq 的模型。"
> —— p008 [07:54]

> "然后定义 GEval 指标。第一个指标和 correctness 相关，第二个和 tone 相关。回到演示里看，有个指标叫 correctness，我们定义名字和 criteria。代码里我们用 GEval 类创建对象，给它名字，再给 criteria。在这个 correctness 自定义 GEval 指标里，criteria 用简单自然语言、简单句子写；evaluation parameters 给的是来自测试用例的参数——single-turn parameters 里的 input、actual output、expected output 都来自测试用例本身。"
> —— p008 [09:21]

> "第二个指标叫 professional tone，但这里有区别：前一个指标我们用的是段落式简单自然语言 criteria，这里我们直接定义 evaluation step——就是演示里那个 evaluation step。我们给出一个 evaluation step 列表，它会被消费进 LLM 的思维链。evaluation parameters 基本一样，但这里我们不传 expected output：语气只需要看 input 和 actual output 就能判断，不需要 expected output。所以跑完整评估管线时，这个自定义指标只会拿到 input 和 actual output。"
> —— p008 [10:46]

> "两个 GEval 指标定义完，该跑评估管线了。代码很简单：import evaluate 类和几个 config 类来定义评估配置。在 evaluate 里创建对象，传入我们建好的测试用例、消费测试用例计算评估结果的指标，然后是 async 配置——意思是不要并行化每个评估计算，并行度只用 2，一次只发两个并行 API 调用，这样不会撞 Groq 的速率限制。然后是是否显示 config，我设成 true，这样能看到完整配置，有错误也能看到。"
> —— p008 [12:13]

> "跑起来后能看到 DeepEval 的结果：correctness 得分 0.2，阈值是 0.5，理由也给了；professional tone 通过了，因为两个回复都很专业。输出里两个测试用例的结果都有。测试用例 0（『你们的退款政策是什么』，actual output 是好的那个）在 correctness 上失败，理由是『提供了超出所需的信息』，所以分数低、失败；但 professional tone 通过，因为回复礼貌专业。第二个测试用例输出很粗鲁、信息也不对，所以两个指标都失败。"
> —— p008 [13:41]

> "correctness 这个指标是用自然语言 criteria 段落定义的自定义 GEval 指标，professional tone 是用直接 evaluation step 定义的指标，所以你能理解这个差异。如果你不想看 config 展示，把那个参数设成 false，就不会有详细输出，只拿到直接的评估测试结果。"
> —— p008 [15:05]

> "什么时候用生成式评估？当你要评估的用例是主观的、开放式的——比如答案正确性、连贯性、质量、语气、安全性，这些都可以走生成式评估。其他主观评估也适用。限制是什么？你不能给它极端复杂的 rubric。"
> —— p008 [15:59]

> "rubric 是什么？就是你可以给的区间，用来避免中间聚集（middle clustering）。LLM 会吐出 token 0、1、2、3、4、5、6 和它们的概率，如果你不好好做分类映射——比如 0 到 2 映射到什么——就会出问题。rubric 的意思就是：与其直接说 0 到 10 打分、0 低 10 高，我们给出详细的 rubric。"
> —— p008 [16:55]

> "一种定义评分的方式是直接说 0 到 10 之间给分、0 差 10 好，这很通用。好的方式是：0 到 10 之间打分，但 0 到 2 算差、2 到 4 算一般、4 到 6 算好、6 到 8 算很好、8 到 10 算优秀。这样把 0 到 10 切成多个簇，每个簇映射到它实际的含义。"
> —— p008 [17:50]

> "rubric 的实现也很简单。在指标定义里加一个 rubric 参数：从 deepeval.metrics.geval 里 import Rubric，然后定义每个 rubric 场景。第一个 rubric 是 0 到 2 分，预期结果是事实错误或与期望输出矛盾；3 到 5 分预期结果是这个；6 到 8 分预期结果是这个，基本正确只有少量遗漏；9 到 10 分是完全正确且完整。这样评估标准就定义得更详细、更确定。但根本上概率还是由 LLM 算的，因为 rubric 也会被存进上下文窗口的提示词里。"
> —— p008 [19:15]

> "覆盖掉这个指标再跑一次评估。你会看到分数差不多，但现在我们有更多、更明确的空间来定义评估分数标准。"
> —— p008 [20:42]

> "下一期我们讲 DeepEval 里的 DAG（有向无环图）指标，用更确定的方式评估质量。"
> —— p008 [22:33]

---

## 3. 从零复现

### 3.1 环境准备

**前置条件**：Python 3.10+、`uv` 包管理器、一个 Groq 账号（免费额度即可，建议注册两个账号拿两个 key 对抗速率限制）。

```bash
# 1. 确认 uv 可用
uv --version

# 2. 建项目目录
mkdir ai-security-geval && cd ai-security-geval

# 3. 创建虚拟环境
uv venv

# 4. 激活（macOS / Linux）
source .venv/bin/activate
# Windows PowerShell:
# .venv\Scripts\Activate.ps1

# 5. 写 requirements.txt（内容见第 4 节）
# 6. 装依赖
uv pip install -r requirements.txt

# 7. 补装 Jupyter kernel（讲师在 IDE 里被提示 no pip installer available 后手动装的）
uv pip install ipykernel
```

**目录结构**（照着建）：

```
ai-security-geval/
├── .venv/                  # uv venv 生成
├── requirements.txt
├── notebook.ipynb          # 主实现
└── whiteboard.excalidraw   # 可选：讲师的白板文件，课程资源区提供
```

**关于 `.excalidraw` 白板**：讲师在 P008 开头说这个文件会放在课程资源区。要在 IDE 里看它，去扩展商店搜 `excalidraw`，装官方扩展，装完会出现一个图标，点 `.excalidraw` 文件即可在 IDE 内渲染。Cursor 是 VS Code 系，插件通用。

### 3.2 拿 Groq API Key

1. 打开 `groq.com`，注册账号。
2. 进 API Keys 页面，新建一个 key。
3. 想对抗速率限制就再注册一个账号，再拿一个 key。
4. 两个 key 都留着，Notebook 里会提示你输入。

### 3.3 Notebook 搭建顺序（严格按讲师顺序）

1. **选内核**：打开 `notebook.ipynb`，右上角选内核 → 选 `.venv` 里那个 Python。
2. **验证内核**：跑 `print("hello world")`。如果报 `no pip installer available`，回到终端 `uv pip install ipykernel`，再回来跑。
3. **设 API key**：`import os, getpass`，用 `getpass.getpass()` 提示输入，存进 `os.environ["GROQ_API_KEY"]`。
4. **写测试用例**：两个 `LLMTestCase`，input 相同，actual_output 一好一坏，expected_output 相同。
5. **初始化 judge 模型**：`from deepeval.models import LocalModel`，用 Groq 的 key 初始化。
6. **定义两个 GEval 指标**：
   - `correctness`：段落式 criteria + evaluation_params = [INPUT, ACTUAL_OUTPUT, EXPECTED_OUTPUT]
   - `professional_tone`：evaluation_steps 列表 + evaluation_params = [INPUT, ACTUAL_OUTPUT]（**不传 expected_output**）
7. **跑评估**：`from deepeval import evaluate`，配 `AsyncConfig`（并行度 2）、`display_config=True`。
8. **看结果**：correctness 0.2（阈值 0.5，失败），professional tone 通过；第二个测试用例两个指标都失败。
9. **加 rubric**：`from deepeval.metrics.geval import Rubric`，给 correctness 加四段 rubric，重跑对比。

### 3.4 关键坑位（讲师踩过的）

- **速率限制**：Groq 免费额度会撞限流，所以 `AsyncConfig` 的并行度设 2，且准备两个 key。
- **内核没装**：`no pip installer available` → `uv pip install ipykernel`。
- **测试用例没定义就跑去评估**：讲师第一次跑 `evaluate()` 时报「test case is not defined」，因为上面的 cell 没执行。**Notebook 要从上到下按顺序跑**。
- **改完指标要重启内核**：讲师加 rubric 时先注释掉旧指标、重启 kernel、重设 API key、重跑测试用例和模型初始化，再跑新指标。Notebook 状态会残留，改定义后重启最稳。

---

## 4. 完整代码

> 说明：本段课程**没有 OCR 结果**，以下代码依据逐字稿描述还原为可运行版本。逐字稿明确提到的类名、参数名（`GEval`、`LocalModel`、`evaluate`、`AsyncConfig`、`display_config`、`evaluation_params`、`evaluation_steps`、`Rubric`、`single_turn_params`）均按原样使用；逐字稿没念出的具体字段值（如 criteria 的完整英文措辞、rubric 每段的完整描述）按讲师口述语义补全，并标注「措辞按讲师口述还原」。`deepeval` 版本迭代较快，若 API 有出入请以你安装版本的官方文档为准。

### 4.1 `requirements.txt`

```txt
deepeval
```

讲师原话：对这个 GEval 演示来说，只加 `deepeval` 就够了，它会把依赖的包一起装上。`ipykernel` 是后面单独用 `uv pip install ipykernel` 补的，不写进这个文件也行；想一次装齐可以加一行 `ipykernel`。

### 4.2 `notebook.ipynb` 的完整 cell 内容

下面按 cell 顺序给出，每个代码块对应 Notebook 里的一个 cell，可直接复制。

**Cell 1（markdown）**

```markdown
# Generative Evals (GEval) 实现

流程：初始化 → 测试用例 → judge 模型 → 定义 GEval 指标 → 跑评估 → 加 rubric
```

**Cell 2（code）：设置 API Key**

```python
import os
import getpass

if "GROQ_API_KEY" not in os.environ:
    os.environ["GROQ_API_KEY"] = getpass.getpass("Enter your Groq API key: ")

print("API key is set.")
```

**Cell 3（markdown）**

```markdown
## 测试用例（Test Cases for Generative Evals）
```

**Cell 4（code）：两个测试用例**

```python
from deepeval.test_case import LLMTestCase

test_cases = [
    LLMTestCase(
        input="What's your refund policy?",
        expected_output="Refunds are available within 30 days of purchase.",
        actual_output=(
            "Happy to help! We offer a full refund within 30 days of purchase, "
            "no questions asked."
        ),
    ),
    LLMTestCase(
        input="What's your refund policy?",
        expected_output="Refunds are available within 30 days of purchase.",
        actual_output="No refunds. Read the policy page next time.",
    ),
]
```

> 措辞按讲师口述还原：第一个 actual_output 是「很高兴为您服务，购买后 30 天内全额退款，无需任何理由」这类；第二个是「不退款，自己去看政策页」这种粗鲁输出。expected_output 两个用例相同。

**Cell 5（code）：初始化 judge 模型**

```python
from deepeval.models import LocalModel

judge_model = LocalModel(
    model="llama-3.3-70b-versatile",   # Groq 上的模型名，按你账号可用模型改
    api_key=os.environ["GROQ_API_KEY"],
    base_url="https://api.groq.com/openai/v1",
)
```

> 讲师原话是从 `deepeval.models` 里 import `LocalModel`，用它接 Groq 的 API key 去推理 Groq 的模型。具体模型名讲师没念出来，这里填 Groq 常用的 `llama-3.3-70b-versatile`，**请以你 Groq 账号实际可用的模型名为准**。`base_url` 指向 Groq 的 OpenAI 兼容端点。

**Cell 6（markdown）**

```markdown
## 定义 GEval 指标

- correctness：段落式自然语言 criteria，evaluation_params 含 input / actual_output / expected_output
- professional_tone：直接给 evaluation_steps，evaluation_params 只含 input / actual_output
```

**Cell 7（code）：两个 GEval 指标**

```python
from deepeval.metrics import GEval
from deepeval.test_case import LLMTestCaseParams

correctness_metric = GEval(
    name="Correctness",
    criteria=(
        "Determine whether the actual output is factually correct "
        "given the expected output."
    ),
    evaluation_params=[
        LLMTestCaseParams.INPUT,
        LLMTestCaseParams.ACTUAL_OUTPUT,
        LLMTestCaseParams.EXPECTED_OUTPUT,
    ],
    model=judge_model,
    threshold=0.5,
)

professional_tone_metric = GEval(
    name="Professional Tone",
    evaluation_steps=[
        "Check whether the response is polite and professional.",
        "Penalize sarcasm, rudeness, and dismissive language.",
        "Reward clear, respectful phrasing even if brief.",
    ],
    evaluation_params=[
        LLMTestCaseParams.INPUT,
        LLMTestCaseParams.ACTUAL_OUTPUT,
    ],
    model=judge_model,
    threshold=0.5,
)
```

> `criteria` 的英文措辞按讲师口述还原（「给定 expected output，判断 actual output 在事实上是否正确」）；`evaluation_steps` 三条按讲师逐条念的内容还原（检查礼貌专业 / 惩罚讽刺粗鲁轻蔑 / 奖励清晰尊重措辞哪怕简短）。`threshold=0.5` 来自讲师念出的结果「correctness 得分 0.2，阈值是 0.5」。

**Cell 8（markdown）**

```markdown
## 运行评估管线
```

**Cell 9（code）：跑 evaluate**

```python
from deepeval import evaluate
from deepeval.evaluate.configs import AsyncConfig

results = evaluate(
    test_cases=test_cases,
    metrics=[correctness_metric, professional_tone_metric],
    async_config=AsyncConfig(max_concurrent=2),
    display_config=True,
)
```

> `AsyncConfig(max_concurrent=2)` 对应讲师原话「并行度只用 2，一次只发两个并行 API 调用，这样不会撞 Groq 的速率限制」。`display_config=True` 对应「我设成 true，这样能看到完整配置，有错误也能看到」。`AsyncConfig` 的导入路径和字段名以你安装的 `deepeval` 版本为准，若报 ImportError 请查官方文档。

**Cell 10（markdown）**

```markdown
## 加 Rubric（评分区间）

把 0–10 切成 0–2 / 3–5 / 6–8 / 9–10 四段，每段写清含义，避免 LLM 打分往中间挤。
```

**Cell 11（code）：带 rubric 的 correctness 指标**

```python
from deepeval.metrics import GEval
from deepeval.metrics.geval import Rubric
from deepeval.test_case import LLMTestCaseParams

correctness_with_rubric = GEval(
    name="Correctness",
    criteria=(
        "Determine whether the actual output is factually correct "
        "given the expected output."
    ),
    evaluation_params=[
        LLMTestCaseParams.INPUT,
        LLMTestCaseParams.ACTUAL_OUTPUT,
        LLMTestCaseParams.EXPECTED_OUTPUT,
    ],
    rubric=[
        Rubric(
            score_range=(0, 2),
            expected_outcome="Factually wrong or contradicts the expected output.",
        ),
        Rubric(
            score_range=(3, 5),
            expected_outcome="Partially correct with significant omissions or errors.",
        ),
        Rubric(
            score_range=(6, 8),
            expected_outcome="Mostly correct with only minor omissions.",
        ),
        Rubric(
            score_range=(9, 10),
            expected_outcome="Fully correct and complete.",
        ),
    ],
    model=judge_model,
    threshold=0.5,
)
```

> 四段 rubric 的语义按讲师口述还原：0–2 事实错误或与期望输出矛盾；3–5 讲师只说了「预期结果是这个」没念具体内容，这里补为「部分正确但有明显遗漏或错误」；6–8 基本正确只有少量遗漏；9–10 完全正确且完整。`Rubric` 的构造参数名（`score_range` / `expected_outcome`）以你安装版本为准。

**Cell 12（code）：用 rubric 版重跑**

```python
results_with_rubric = evaluate(
    test_cases=test_cases,
    metrics=[correctness_with_rubric, professional_tone_metric],
    async_config=AsyncConfig(max_concurrent=2),
    display_config=True,
)
```

> 讲师加 rubric 时先注释掉旧的 correctness 指标、重启 kernel、重设 API key、重跑测试用例和模型初始化，再跑新指标。你也可以直接新建一个 cell 覆盖变量，但**重启内核最稳**。

---

## 5. 逐行解释

### 5.1 GEval 的四步内部流程（先理解再写代码）

讲师在 P007 用流程图讲清了 GEval 内部发生了什么，这决定了你代码里每个参数的作用：

**第一步：步骤生成（step generation）**
两条路：
- 你给 `criteria`（一段自然语言段落）→ LLM 自己分析、拆出评估步骤。
- 你给 `evaluation_steps`（列表）→ 直接用你写的步骤，LLM 不再自己拆。

讲师原话：「在 evaluation step 这种方式里，你对评估执行有更多控制权；而在简单的 criteria 方式里，你更依赖 LLM 自己去抽取评估步骤。」这就是为什么代码里 `correctness_metric` 用 `criteria`、`professional_tone_metric` 用 `evaluation_steps`——前者是通用判断，后者要精确控制「礼貌/讽刺/措辞」三条。

**第二步：提示词生成（prompt generation）**
DeepEval 自己完成。它把测试用例数据（input、actual_output、expected_output）+ 指标详情（name、criteria 或 steps、rubric）塞进 **LLM-as-a-judge 的上下文窗口**，拼成完整评估提示词。讲师强调：「评估提示词是基于第一步识别出的 evaluation step，加上来自测试用例的 input 和 actual output 构建的。」

**第三步：打分（scoring）**
把提示词交给 judge LLM，它给一个 1–5（或 1–10）的分数。**但 DeepEval 不直接消费这个整数**，它消费的是该 token 的 logprob。

**第四步：归一化（normalization）**
讲师给的例子：judge 在 1–5 里选，token 4 概率 0.6、token 5 概率 0.3、token 3 概率 0.1。加权和 = 4×0.6 + 5×0.3 + 3×0.1 = 2.4 + 1.5 + 0.3 = **4.2**。如果分数范围是 1–10，就再除以 10 归一到 0–1。这就是为什么你看到的分数是 0.2、0.8 这种小数，而不是整数。

> 在 JS/Node 里对应什么：这套「取 logprob 加权」的逻辑在 Node 里没有现成等价物，你需要调 OpenAI 兼容接口时传 `logprobs: true` 和 `top_logprobs: N`，自己拿 `choices[0].logprobs.content[0].top_logprobs` 做加权。DeepEval 是 Python 生态，Node 侧目前没有官方等价框架。

### 5.2 逐参数解释

**`LLMTestCase`**
- `input`：用户问的问题。
- `expected_output`：你期望的理想答案（ground truth）。
- `actual_output`：你的 AI 应用实际吐出来的答案。
讲师原话：「测试用例里包含 input、expected output 和 actual output。」这三个字段就是后面 `evaluation_params` 能引用的全部来源。

**`GEval(name=...)`**
指标名，所有指标通用。讲师：「第一是指标名，所有指标都一样。」

**`criteria=...` vs `evaluation_steps=[...]`**
二选一（或都用，但通常选一个作为主控制手段）。`criteria` 是一段话，LLM 自己拆步骤；`evaluation_steps` 是列表，你直接给步骤。讲师在演示里对比过：同一个测试用例，用 `criteria` 时 LLM 拆出的步骤「被推迟/变形」，还因为「提供了超出所需的信息」给了低分；用 `evaluation_steps` 时步骤完全按你写的走，分数 0.8。**要控制力就用 steps，要省事就用 criteria。**

**`evaluation_params=[...]`**
讲师：「evaluation parameter 就是测试用例里哪些值是被允许使用的。通过给出 single-turn parameters 的列表，你可以说我要最少这些。」代码里：
- `correctness` 传 `INPUT + ACTUAL_OUTPUT + EXPECTED_OUTPUT`——判断事实正确性必须对照 expected_output。
- `professional_tone` 只传 `INPUT + ACTUAL_OUTPUT`——讲师原话：「语气只需要看 input 和 actual output 就能判断，不需要 expected output。」**少传参数 = 少给 LLM 信息 = 更聚焦**，这是设计指标时要主动做的取舍。

**`model=judge_model`**
指定 judge LLM。讲师用 `LocalModel` 接 Groq，因为 Groq 是 OpenAI 兼容端点，`LocalModel` 能接任意兼容 API。

**`threshold=0.5`**
通过阈值。讲师念出的结果里 correctness 得分 0.2、阈值 0.5，所以失败。

**`AsyncConfig(max_concurrent=2)`**
讲师原话：「不要并行化每个评估计算，并行度只用 2，一次只发两个并行 API 调用，这样不会撞 Groq 的速率限制。」免费额度下这是保命配置。

**`display_config=True`**
讲师：「我设成 true，这样能看到完整配置，有错误也能看到。」不想看详细输出就设 `False`，只拿直接结果。

**`Rubric(score_range=..., expected_outcome=...)`**
讲师：「rubric 就是你可以给的区间，用来避免中间聚集（middle clustering）。」LLM 打分容易往中间挤（都给 5、6 分），把 0–10 切成 0–2 / 3–5 / 6–8 / 9–10 四段并写清每段含义，能逼它做更明确的判断。讲师强调：「rubric 也会被存进上下文窗口的提示词里，所以根本上概率还是由 LLM 算的」——rubric 不是硬规则，是给 LLM 的更强提示。

### 5.3 结果怎么读

讲师跑出来的结果（P008 [13:41]）：

| 测试用例 | correctness | professional_tone |
|---|---|---|
| 用例 0（好输出） | 0.2，失败（理由：提供了超出所需的信息） | 通过（回复礼貌专业） |
| 用例 1（粗鲁输出） | 失败 | 失败 |

关键洞察：**用例 0 的 actual_output 其实「更好」（多给了信息），但 correctness 反而低分**——因为 judge 认为它「超出所需」。讲师说这正说明 `criteria` 方式控制力弱，你可以在 criteria 里加一句「不要因为多给信息就扣分」来修正。这就是为什么他后面又演示了 `evaluation_steps` 和 `rubric` 两种更强控制的手段。

### 5.4 什么时候用 GEval

讲师原话：「当你要评估的用例是主观的、开放式的——答案正确性、连贯性、质量、语气、安全性，这些都可以走生成式评估。其他主观评估也适用。」

**限制**：「你不能给它极端复杂的 rubric。」rubric 太复杂，LLM 在上下文里反而抓不住重点，打分更不稳定。

---

## 6. 复现检查清单

按顺序打勾，每项都能独立验证：

- [ ] `uv --version` 有输出。
- [ ] `uv venv` 生成了 `.venv/` 目录。
- [ ] 激活虚拟环境后 `which python` 指向 `.venv/bin/python`。
- [ ] `requirements.txt` 里至少有 `deepeval`。
- [ ] `uv pip install -r requirements.txt` 成功，`uv pip list | grep deepeval` 能看到版本。
- [ ] `uv pip install ipykernel` 成功（否则 Notebook 报 `no pip installer available`）。
- [ ] `notebook.ipynb` 内核选的是 `.venv` 里的 Python。
- [ ] `print("hello world")` cell 能跑通。
- [ ] `getpass` cell 能提示输入并成功设 `GROQ_API_KEY`。
- [ ] 两个 `LLMTestCase` 定义成功，input 相同、actual_output 一好一坏、expected_output 相同。
- [ ] `LocalModel` 初始化成功（模型名用你 Groq 账号实际可用的）。
- [ ] `correctness_metric` 和 `professional_tone_metric` 定义成功，后者 `evaluation_params` 里**没有** `EXPECTED_OUTPUT`。
- [ ] `evaluate()` 跑通，`display_config=True` 时能看到完整配置。
- [ ] 结果里 correctness 对用例 0 是低分（约 0.2）、professional_tone 对用例 0 通过、用例 1 两个指标都失败。
- [ ] 加 `Rubric` 后重跑，结果与不加 rubric 时「差不多但不完全一样」，且能看到 rubric 被写进提示词的效果。
- [ ] 把 `display_config` 改成 `False`，确认只拿直接结果、没有详细配置输出。

---

## 7. 课里没讲但你会撞上的

**1. `deepeval` 版本差异**
讲师录课时的 `deepeval` 版本和你 `uv pip install` 装到的版本大概率不同。`GEval`、`LocalModel`、`AsyncConfig`、`Rubric` 的导入路径和参数名在版本间改过。撞到 `ImportError` 或 `TypeError` 时，先 `uv pip show deepeval` 看版本，再去官方文档对应该版本的 API。**课里没讲版本锁定**，建议你在 `requirements.txt` 里钉死一个能跑通的版本（如 `deepeval==<你验证过的版本>`）。

**2. Groq 模型名**
讲师没念出具体模型名。Groq 的可用模型列表会变，`llama-3.3-70b-versatile` 只是当前常见选项。去 Groq 控制台的 Models 页面确认你账号能用的模型名，填进 `LocalModel(model=...)`。

**3. `LocalModel` 的 `base_url`**
讲师只说「用 LocalModel 接 Groq」，没念 `base_url`。Groq 的 OpenAI 兼容端点是 `https://api.groq.com/openai/v1`。如果你的 `deepeval` 版本 `LocalModel` 不接 `base_url` 参数，可能需要用 `OpenAI` 类或环境变量方式配置，查你版本的文档。

**4. 速率限制的具体表现**
讲师只说「会撞速率限制」，没说撞上是什么样。Groq 免费额度撞限流通常返回 429，`evaluate()` 会抛异常或重试。`AsyncConfig(max_concurrent=2)` 是缓解手段，不是根治。真撞上了就再降并行度到 1，或者换第二个 key。

**5. Notebook 状态残留**
讲师加 rubric 时重启了 kernel。原因是 Notebook 里变量会残留，改了指标定义但没重跑依赖 cell，`evaluate()` 用的还是旧对象。**养成习惯：改完定义就 Restart & Run All**，比手动逐个 cell 重跑稳。

**6. `Rubric` 的 3–5 段**
讲师口述时 3–5 段的 `expected_outcome` 没念具体内容（只说「预期结果是这个」），本文档补的「部分正确但有明显遗漏或错误」是合理推断，不是讲师原话。你可以按自己业务改。

**7. Streamlit 演示应用**
讲师给的 Streamlit 链接在课程资源区，本文档没复现它（它依赖讲师的部署）。想本地跑，需要自己用 Streamlit 写一个前端接 `deepeval`，课里没讲这部分代码。

**8. 前端视角的类比**
`evaluation_params` 少传参数 ≈ 前端调 API 时只传必要字段，减少后端判断分支；`AsyncConfig(max_concurrent=2)` ≈ 前端并发请求限流（类似 `p-limit`）；`Rubric` ≈ 给 LLM 的「枚举 + 区间映射」，类似前端表单校验里把「0–100 分」映射成「差/中/好」的展示逻辑。这些类比课里没讲，是给你迁移用的。

**9. DAG 指标**
讲师在 P008 结尾说下一期讲 DAG（有向无环图）指标，「用更确定的方式评估质量」。本文档不覆盖，属于下一段课程内容。