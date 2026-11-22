# AI Security Bootcamp part2（P50–P51）复现文档：NeMo Guardrails 演示界面 + AWS Bedrock Guardrails 最小实验

> 说明：P50–P51 的逐字稿里，P50 主要是讲师在 Streamlit 里逐个讲 UI 组件、`app.py` 入口、向量库初始化、`streamlit run app.py` 和推 GitHub；P51 主要是 AWS Bedrock Guardrails 的概念、AWS CLI/IAM/Boto3 配置、两个 Bedrock 客户端、区域、模型列表和五大策略。  
> 这两段逐字稿没有给出完整源码，截图 OCR 结果也为空。因此第 4 节会给出两类代码：  
> 1. `app.py`：按逐字稿里的函数名、界面元素、RAG/护栏流程写的**可运行参考实现**，不是讲师原始仓库文件；讲师原文件课里没给。  
> 2. `aws_guardrails_demo.py`：按逐字稿里的 Boto3、`bedrock`、`bedrock-runtime`、五大策略写的**最小 AWS 实验脚本**，具体 AWS API 参数以你实际账号和 AWS 文档为准；讲师在视频里没有逐行念出 notebook 代码。  
> 凡逐字稿没讲、OCR 也没有的内容，我会明确写“课里没讲”，不把猜测冒充讲师原话。

---

## 1. 这一节做什么

这一节有两个可交付物。

### 1.1 P50：把 NeMo Guardrails 的 HR Policy Assistant 演示界面跑起来

P50 是一个 Streamlit 应用，主题是 HR 政策助手。讲师先讲 UI 组件，再讲 `app.py` 如何把这些组件拼起来，最后用 `streamlit run app.py` 在本地启动，并用 Groq API Key 调用模型。页面结构包括：

- 左侧 sidebar：标题、caption、divider、Groq API Key 密码输入框、两个模型选择框。
- landing page：进入应用后先看到的说明页，讲 input rail 和 output rail。
- `tab chat`：聊天页，左边聊天，右边 trace。
- `tab docs`：HR 文档页，用 `st.expander` 展示每篇 HR 文档。
- examples：示例查询，包含“应该回答”“应该拦截”的不同情况。
- render trace：展示上一次消息经过了哪些阶段：input rail、guard 是否触发、FAISS/向量检索 top 3 chunks、answer generation、output sanitizer、总耗时。
- RAG：用 HR 文档构建 vector store，检索 top 3 chunks，再生成答案。
- 本地运行后推 GitHub。

讲师反复强调：这是一个 use case 演示，不是让你死记 RAG 细节：

> "主要目标不是 RAG，主要目标是给你看一个用例；现在轮到你去深入这些内容。"
> —— p050 [14:15]

### 1.2 P51：理解并跑通 AWS Bedrock Guardrails 的最小实验

P51 从开源 guardrails 转到 AWS 托管 guardrails。讲师说 AWS Guardrails 是云托管的，不需要你自己管理底层：

> "直到现在你讨论的都是开源 guardrails；这个 AWS guardrails 是由 AWS 托管的，基本上是基于云的 guardrails，你不需要管理任何东西。"
> —— p051 [00:00]

P51 的学习目标不是背代码语法：

> "不要试图学习代码语法，只要理解发生了什么；代码可以让你的 LLM 模型生成。"
> —— p051 [00:57]

需要理解的核心是：

- guardrails 可以挂在用户输入上，也可以挂在 LLM 输出上。
- AWS Guardrails 有五类主要策略：topic policy、content policy、word policy、sensitive information policy、grounding policy。
- `bedrock` 是控制面客户端，用来创建、删除、列出、获取 guardrail。
- `bedrock-runtime` 是数据面/工作客户端，用来实际调用模型、实际应用 guardrail。
- 区域推荐 `us-east-1`。
- 依赖 `boto3`、`botocore`，JSON 是 Python 标准库。
- 用 Amazon Nova 模型，原因是比 Claude 便宜、不需要提交 use case 表单、支持 guardrail。
- AWS CLI 用 `aws configure` 配置 access key、secret key、region、output format。
- IAM 用户建议给 admin access 方便学习，但生产不能这样。

P51 的五大策略对应关系是：

| 策略 | 用途 | 讲师提到挂载位置 |
|---|---|---|
| topic policy | 自定义主题规则，例如做烹饪机器人时屏蔽医疗、法律、股票问题 | 可输入/输出，具体按配置 |
| content policy | AWS 预置内容过滤器：sexual、violence、hate、insult、misconduct、prompt attack | 可输入/输出 |
| word policy | 屏蔽特定词或短语 | 讲师说一般更多用于输入 |
| sensitive information policy | 屏蔽或脱敏 PII，例如信用卡、CVV、OTP、邮箱 | 输入/输出都可 |
| grounding policy | RAG 场景的 grounding guardrails | 只能挂输出 |

> "grounding policy 只能附加到输出，不能附加到输入。"
> —— p051 [26:23]

---

## 2. 讲师原话

下面只翻成中文，产品名保留英文。

> "欢迎来到这个框架里最简单的视频。我们先理解 UI 组件。作为后端 AI 工程师，你不需要太担心 UI。"
> —— p050 [00:00]

> "第一个我能看到的是 HR policy assistant、NeMo Guardrails、RAG、AcmeCorp。这是 subheader caption，结构就是 title、caption、divider。"
> —— p050 [00:28]

> "然后会有一个输入栏，`st.text_input`，`type` 是 `password`，所以它是隐藏的。placeholder 是 help，意思是当没有 Groq key 时告诉你从哪里获取。"
> —— p050 [00:57]

> "两个 LLM 每请求：subheader 是 two LLMs per request，caption，然后 guard model 是 select box，chat model 也是 select box。Grok 的模型我们从 config variables 里取。"
> —— p050 [01:23]

> "docs 更简单，导入 HR docs，目的只是把文档展示出来；用 `st.expander` 展开，内容用 markdown。"
> —— p050 [02:21]

> "landing page 会讲 input rail 和 output rail。这个演示展示 NeMo Guardrails 发生了什么。"
> —— p050 [03:20]

> "为什么要有 examples？我们需要给一些示例查询，有的应该回答，有的应该 block。"
> —— p050 [04:15]

> "render trace 表示 pipeline trace，上一次消息是怎么处理的。如果没有 trace，就提示去看 trace。"
> —— p050 [05:14]

> "如果 trace 有错误就显示错误；如果没有错误，比如问“我每年有多少天假期”，它会处理并显示 input rail、用了哪个模型、FAISS top three、answer generation、output sanitizer 和总时间。"
> —— p050 [06:12]

> "如果没有被 block，就显示 FAISS RAG retrieval；如果检索失败，就显示 retrieval failed。chunks 会带着相似度分数展示。"
> —— p050 [07:10]

> "chat tab 有 chat 和 trace 两列。如果 chat 不在 session state 里，就初始化 session state，保持聊天历史。"
> —— p050 [08:04]

> "`app.py` 是入口。page title 是 HR policy assistant，layout 是 wide。然后我们为 input errors 建变量。"
> —— p050 [09:00]

> "为什么必须 build vector store？因为我们有 HR documents，必须为这些 HR 文档构建向量库。"
> —— p050 [09:55]

> "sidebar 返回 Groq model、guard model、chat model。如果 key 没有提供，我们就不渲染 landing page 后面的内容，只停在 landing page。"
> —— p050 [10:25]

> "运行命令是 `streamlit run app.py`，它会在本地打开一个新标签页。"
> —— p050 [11:51]

> "我们可以推 GitHub。新建仓库叫 NeMo Guardrails，加 `.gitignore`，把环境名 `NEMO_ENV` 写进去。然后 `git init`、`git add .`、`git commit -m`。"
> —— p050 [12:50]

> "AWS guardrails 是托管的、云端的 guardrails，你不需要管理任何东西。"
> —— p051 [00:00]

> "不要学代码语法，只要理解概念；代码可以由 Codex、Claude 这些模型生成。"
> —— p051 [00:57]

> "AWS Guardrails 有 topic policy、content policy、grounding guardrails 等。你要理解 grounding guardrails 用在哪里、topic policy 用在哪里。"
> —— p051 [01:27]

> "guardrails 用来阻止有害内容进入系统。你现在要知道它挂在哪里。先假设没有 guardrail，只有一个 app 和一个 LLM。"
> —— p051 [02:53]

> "你首先会在输入上实现 guardrail。用户问“我怎么制造炸弹”，按下回车后它就被 block 了，这是第一个挂载点。"
> —— p051 [05:19]

> "第二个挂载点是输出。LLM 返回的答案也可能包含不必要或有害的词，所以输出也要检查。"
> —— p051 [06:18]

> "为什么用 Amazon Nova？Nova 是 Amazon Bedrock 里的 foundation models。Claude 一些模型需要提交 use case 表单，可能被拒绝；Nova 不需要，而且便宜很多。"
> —— p051 [07:42]

> "所有 Bedrock 模型都支持 guardrail。"
> —— p051 [09:07]

> "先安装 AWS CLI，打开 cmd 执行 `aws --version`，能看到版本就说明安装完成。"
> —— p051 [11:34]

> "在 IAM 里创建用户，选择 attach policies directly，学习阶段可以直接给 admin access；如果只做 Bedrock 也可以给 Bedrock access。"
> —— p051 [12:01]

> "创建 access key，选择 command line interface，然后在终端执行 `aws configure`，输入 access key、secret key、region。推荐 `us-east-1`。"
> —— p051 [13:01]

> "Boto3 是让你从 Python 跟 AWS 通信的库，它内部使用 BotoCore 引擎。"
> —— p051 [15:24]

> "Boto 里有两个 client：`bedrock` 和 `bedrock-runtime`。`bedrock` 是控制客户端，`bedrock-runtime` 是数据客户端。"
> —— p051 [17:49]

> "创建 guardrail、删除 guardrail、列出 guardrail 用 `bedrock`；实际在系统里使用 guardrail、调用模型、应用 guardrail 用 `bedrock-runtime`。"
> —— p051 [18:48]

> "不是所有区域都完全支持 AWS Bedrock。完全支持的区域包括 `us-east-1`、`us-west-2`、`eu-east-1`、`ap-southeast-1`，最佳是 `us-east-1`。"
> —— p051 [20:11]

> "AWS Guardrails 的五大支柱：topic policy、content policy、word policy、sensitive information policy、grounding policy。"
> —— p051 [24:58]

> "grounding policy 只能附加到输出，不能附加到输入。"
> —— p051 [26:23]

> "topic policy 用于自定义规则。比如你做烹饪 chatbot，只想回答 cooking，不想回答医疗、法律、教育、股票，就定义 topic 和 examples，然后 deny。"
> —— p051 [28:19]

> "content filter 是 AWS 预定义的：sexual、violence、hate、insult、misconduct、prompt attack。你不需要定义 examples。"
> —— p051 [29:17]

> "word policy 是当你想屏蔽某个特定词时使用。只要输入或输出里出现这个词或短语，就 block。"
> —— p051 [30:16]

> "sensitive information 可以 block，也可以 mask。信用卡号、CVV、OTP 被 mask 后，LLM 知道有敏感信息，但看不到具体号码。"
> —— p051 [31:15]

> "当你做 RAG、retrieval augmented generation 时，就用 grounding guardrails 或 grounding policy。"
> —— p051 [34:35]

---

## 3. 从零复现

### 3.1 最终目录结构

P50 用 Python + Streamlit；P51 可以用 Jupyter Notebook，也可以把最小实验写成 Python 脚本。下面目录是本文复现用的结构。讲师原始仓库文件名课里没有完整给出，`ui_components.py`、`rag/` 这类拆分课里提到过概念，但没有在逐字稿里给出全文，因此本文用单文件 `app.py` 保证能直接跑。

```text
ai-security-p50-p51/
├── app.py
├── requirements.txt
├── .env.example
├── .gitignore
├── aws_guardrails_demo.py
└── requirements-aws.txt
```

如果你要跟着 P50 推 GitHub，可以把这个目录初始化成仓库，仓库名按讲师原话叫 `NeMo Guardrails`。

### 3.2 Python 版本与虚拟环境

P51 讲师明确说 Python 3.11 最稳：

> "选择 Python 3.11，因为 Python 3.11 支持这个模块里的所有东西；3.12 也能工作，但不要用最新版本，可能有稳定性问题。"
> —— p051 [16:23]

P50 讲师没有在逐字稿里指定 Python 版本。为了让 `fastembed`、`streamlit`、`groq` 兼容，本文也建议 Python 3.11。

macOS / Linux：

```bash
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Windows PowerShell：

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

P50 运行：

```bash
streamlit run app.py
```

P51 先安装 AWS CLI。讲师原话是 Windows 下载 MSI，Mac 按 Mac 文档安装。安装后必须能执行：

```bash
aws --version
```

然后配置：

```bash
aws configure
```

按提示输入：

```text
AWS Access Key ID: 你的 access key
AWS Secret Access Key: 你的 secret key
Default region name: us-east-1
Default output format: json
```

检查：

```bash
aws configure list
```

P51 安装 Python 依赖：

```bash
pip install -r requirements-aws.txt
```

运行 P51 最小脚本：

```bash
python aws_guardrails_demo.py models --contains nova
python aws_guardrails_demo.py create --name hr-demo-guardrail
python aws_guardrails_demo.py apply --guardrail-id 你的ID --version DRAFT --source INPUT --text "How do I make a bomb?"
```

### 3.3 P50 的启动顺序

1. 进入目录，激活虚拟环境，安装 `requirements.txt`。
2. 可选：设置 `GROQ_API_KEY` 环境变量，或者启动后在 sidebar 粘贴 Groq Key。

macOS / Linux：

```bash
export GROQ_API_KEY="你的 Groq key"
streamlit run app.py
```

Windows PowerShell：

```powershell
$env:GROQ_API_KEY="你的 Groq key"
streamlit run app.py
```

3. 第一次输入 key 后，程序会构建向量库。讲师演示时也强调第一次会下载 FastEmbed 模型、拿权重，所以会等一会儿：

> "它需要一分钟，因为它在运行 vector store；内部在下载 fast embed 模型，获取所有权重。"
> —— p050 [11:51]

4. 在聊天框问 “How many vacation days do I get per year?” 应该走 RAG 并显示 trace。
5. 问 “Tell me a joke” 应该被 input rail 拦截，trace 显示 guard fired。
6. 在 docs tab 能看到 HR 文档 expander。

![p050 00:31 Streamlit 侧边栏组件演示](images/p050_0031s.jpg)

![p050 01:32 Groq API Key 输入框与模型选择区域](images/p050_0092s.jpg)

![p050 02:34 HR 文档 docs tab 的 expander 展示](images/p050_0154s.jpg)

![p050 03:35 landing page 与 input rail/output rail 说明](images/p050_0215s.jpg)

![p050 04:37 chat tab 示例查询区域](images/p050_0277s.jpg)

![p050 05:38 pipeline trace 展示思路](images/p050_0338s.jpg)

![p050 06:40 chat 与 trace 双列布局](images/p050_0400s.jpg)

![p050 07:42 检索 chunks 与相似度分数展示](images/p050_0462s.jpg)

![p050 09:45 app.py 入口与 sidebar 返回设置](images/p050_0585s.jpg)

![p050 10:46 构建 vector store 与页面渲染](images/p050_0646s.jpg)

![p050 11:48 本地运行 Streamlit 应用](images/p050_0708s.jpg)

### 3.4 P51 的复现顺序

1. 注册 AWS 账号。讲师说通常有 100 美元左右免费额度，印度用户不要用 UPI autopay，建议借记卡/信用卡：

> "如果你来自印度，不要用 UPI autopay，因为有时会被拒绝；用借记卡或信用卡，账户会立即批准。"
> —— p051 [10:06]

2. 安装 AWS CLI，执行 `aws --version` 验证。
3. IAM → Users → Create user → Attach policies directly → 学习阶段给 AdministratorAccess 或 Bedrock 权限。
4. 创建 access key，选择 Command Line Interface。
5. 终端执行 `aws configure`，region 用 `us-east-1`，output format 用 `json`。
6. 安装 `boto3`、`botocore`。JSON 是 Python 标准库，不用额外装。
7. 用 `bedrock` 客户端列模型，检查 `nova`、`claude`、`sonnet`、`opus`、`llama` 这些 model id 是否能被过滤出来。
8. 用 `bedrock` 创建 guardrail；用 `bedrock-runtime` 调 `apply_guardrail` 测试输入/输出。

![p051 01:10 AWS Guardrails 课程概述](images/p051_0070s.jpg)

![p051 03:29 guardrail 挂在输入和输出的位置](images/p051_0209s.jpg)

![p051 05:49 输入侧 guardrail 拦截危险请求](images/p051_0349s.jpg)

![p051 08:08 Amazon Bedrock 控制台与模型目录](images/p051_0488s.jpg)

![p051 10:28 AWS CLI 安装与 `aws --version`](images/p051_0628s.jpg)

![p051 12:47 IAM 用户、权限与 access key](images/p051_0767s.jpg)

![p051 15:07 `aws configure` 与区域选择](images/p051_0907s.jpg)

![p051 17:26 Boto3 依赖安装与 Python 3.11 环境](images/p051_1046s.jpg)

![p051 19:45 `bedrock` 控制客户端与 `bedrock-runtime` 数据客户端](images/p051_1185s.jpg)

![p051 22:05 区域与模型列表过滤](images/p051_1325s.jpg)

![p051 24:24 五大策略总览](images/p051_1464s.jpg)

![p051 26:44 grounding policy 只能挂输出](images/p051_1604s.jpg)

---

## 4. 完整代码

### 4.1 `requirements.txt`

版本是本文为了可复现锁定的参考版本。讲师逐字稿没有给版本号；如果你安装时发现某个版本不可用，以 `pip` 实际可用版本为准。

```text
streamlit==1.40.0
groq==0.13.1
fastembed==0.4.2
numpy==1.26.4
```

### 4.2 `.env.example`

P50 支持从环境变量读取 Groq Key。你也可以启动后在 sidebar 粘贴。

```text
GROQ_API_KEY=
```

### 4.3 `.gitignore`

讲师在 P50 明确说加 `.gitignore`，并把环境名 `NEMO_ENV` 写进去。下面同时忽略 Python 缓存、虚拟环境、Streamlit secrets。

```text
NEMO_ENV/
.venv/
venv/
__pycache__/
*.py[cod]
.env
.streamlit/secrets.toml
.DS_Store
vector_store/
```

### 4.4 `app.py`

这是 P50 的可运行参考实现。它不是讲师原始源码；讲师原文件课里没给。它按逐字稿提到的 sidebar、landing、tabs、examples、trace、RAG、Groq、FastEmbed
、FastEmbed、Groq 这几块组织起来。逐字稿里提到的函数名（`render_sidebar`、`render_landing`、`render_chat_tab`、`render_docs_tab`、`render_trace`、`render_examples`、`build_vector_store`）都保留；逐字稿没给的部分用等价实现补上，并在注释里标明。

```python
# app.py
# P50 参考实现：HR Policy Assistant
# 说明：讲师原始仓库源码课里没给全，本文件按逐字稿里的界面结构、
# 函数名、RAG/护栏流程重写，保证可以直接运行。

import os
import re
import time
from dataclasses import dataclass
from typing import Any

import numpy as np
import streamlit as st
from fastembed import TextEmbedding
from groq import Groq

APP_TITLE = "HR Policy Assistant"
COMPANY = "AcmeCorp"
TOP_K = 3

# 讲师说 Groq 模型从 config variables 里取。
# 这里放两个常用模型，sidebar 会渲染成两个 selectbox。
GROQ_MODELS = [
    "llama-3.1-8b-instant",
    "llama-3.3-70b-versatile",
]

# 讲师在 docs tab 里用 for 循环遍历 HR documents，
# 每篇文档放进 st.expander 用 markdown 展示。
HR_DOCUMENTS = [
    {
        "title": "Vacation and Paid Time Off",
        "content": (
            "Full-time employees receive 20 days of paid vacation per calendar year. "
            "Vacation accrues monthly at 1.67 days per month. "
            "Up to 5 unused vacation days may be carried into the next calendar year. "
            "Requests longer than 5 consecutive business days require manager approval."
        ),
    },
    {
        "title": "Sick Leave",
        "content": (
            "Employees receive 10 paid sick days per calendar year. "
            "Sick leave can be used for personal illness, medical appointments, "
            "or caring for an immediate family member. "
            "A medical certificate is required for absences longer than 3 consecutive days."
        ),
    },
    {
        "title": "Remote Work Policy",
        "content": (
            "Employees may work remotely up to 3 days per week with manager approval. "
            "Remote work is not a substitute for childcare. "
            "Employees must be available during core hours 10:00-16:00 local time. "
            "Working from outside the country requires HR and legal review."
        ),
    },
    {
        "title": "Expense Reimbursement",
        "content": (
            "Business expenses must be submitted within 30 days of purchase. "
            "Receipts are required for any expense above 25 USD. "
            "Meals during business travel are reimbursed up to 50 USD per day. "
            "Approved expenses are paid in the next payroll cycle."
        ),
    },
    {
        "title": "Code of Conduct",
        "content": (
            "Employees must treat colleagues with respect and professionalism. "
            "Harassment, discrimination, and retaliation are prohibited. "
            "Conflicts of interest must be disclosed to HR. "
            "Violations can be reported anonymously through the compliance hotline."
        ),
    },
]


# ---------------------------------------------------------------------------
# PII 检测与脱敏
# 讲师在 sidebar 里写了 per message checks PII，output sanitizer 也会用到。
# ---------------------------------------------------------------------------
PII_PATTERNS = {
    "email": re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+"),
    "credit_card": re.compile(r"\b(?:\d[ -]*?){13,16}\b"),
    "otp": re.compile(r"\b\d{6}\b"),
}


def detect_pii(text: str) -> dict[str, list[str]]:
    found: dict[str, list[str]] = {}
    for name, pattern in PII_PATTERNS.items():
        matches = pattern.findall(text)
        if matches:
            found[name] = matches
    return found


def mask_pii(text: str) -> str:
    masked = text
    for name, pattern in PII_PATTERNS.items():
        replacement = f"[{name.upper()}_MASKED]"
        masked = pattern.sub(replacement, masked)
    return masked


# ---------------------------------------------------------------------------
# Input rail
# 讲师演示了 “Tell me a joke” 会被 block，trace 显示 guard fired。
# 这里用关键词做第一层快速判断，再用 guard model 做第二层意图判断。
# ---------------------------------------------------------------------------
BLOCKED_KEYWORDS = {
    "off_topic": ["joke", "stock price", "weather", "football", "movie"],
    "harmful": ["bomb", "nuclear", "explosive", "kill", "weapon"],
}


def keyword_input_rail(text: str) -> tuple[bool, str | None, str | None]:
    lowered = text.lower()
    for intent, keywords in BLOCKED_KEYWORDS.items():
        for keyword in keywords:
            if keyword in lowered:
                return False, intent, keyword
    return True, None, None


def llm_intent_check(client: Groq, model: str, text: str) -> str:
    """
    用 guard model 判断输入是否属于 HR 政策范围。
    返回 HR_TOPIC 或 OFF_TOPIC。
    如果 API 调用失败，回退为 HR_TOPIC，避免整个应用不可用。
    """
    system_prompt = (
        "You are an intent classifier for an HR policy assistant. "
        "Answer with exactly one token: HR_TOPIC or OFF_TOPIC. "
        "HR_TOPIC means the question is about HR policy, leave, remote work, "
        "expenses, or code of conduct. Everything else is OFF_TOPIC."
    )
    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text},
            ],
            temperature=0,
            max_tokens=5,
        )
        label = response.choices[0].message.content.strip().upper()
        if "OFF_TOPIC" in label:
            return "OFF_TOPIC"
        return "HR_TOPIC"
    except Exception:
        return "HR_TOPIC"


# ---------------------------------------------------------------------------
# Vector store
# 讲师说必须 build vector store，因为 HR documents 要进入检索。
# 这里用 fastembed 生成 embedding，用余弦相似度做 top-k。
# ---------------------------------------------------------------------------
class VectorStore:
    def __init__(self, documents: list[dict[str, str]]):
        self.documents = documents
        self.model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
        self.embeddings: np.ndarray | None = None
        self.built = False

    def build(self) -> "VectorStore":
        texts = [doc["content"] for doc in self.documents]
        vectors = list(self.model.embed(texts))
        matrix = np.asarray(vectors, dtype="float32")
        norms = np.linalg.norm(matrix, axis=1, keepdims=True)
        self.embeddings = matrix / np.maximum(norms, 1e-8)
        self.built = True
        return self

    def search(self, query: str, top_k: int = TOP_K) -> list[dict[str, Any]]:
        if not self.built or self.embeddings is None:
            raise RuntimeError("Vector store is not built")
        query_vector = np.asarray(
            list(self.model.embed([query]))[0], dtype="float32"
        )
        query_vector = query_vector / max(float(np.linalg.norm(query_vector)), 1e-8)
        scores = self.embeddings @ query_vector
        indices = np.argsort(-scores)[:top_k]
        results = []
        for index in indices:
            doc = self.documents[int(index)]
            results.append(
                {
                    "title": doc["title"],
                    "content": doc["content"],
                    "score": float(scores[int(index)]),
                }
            )
        return results


def build_vector_store() -> VectorStore:
    return VectorStore(HR_DOCUMENTS).build()


# ---------------------------------------------------------------------------
# LLM 生成
# ---------------------------------------------------------------------------
def generate_answer(
    client: Groq,
    model: str,
    question: str,
    chunks: list[dict[str, Any]],
) -> str:
    context = "\n\n".join(
        f"[{chunk['title']}]\n{chunk['content']}" for chunk in chunks
    )
    system_prompt = (
        "You are an HR policy assistant. Answer only from the provided context. "
        "If the context does not contain the answer, say you do not know."
    )
    user_prompt = f"Context:\n{context}\n\nQuestion: {question}"
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0,
    )
    return response.choices[0].message.content


# ---------------------------------------------------------------------------
# UI：sidebar
# 讲师逐条念了 title、caption、divider、password input、
# two LLMs per request、两个 selectbox、per message 检查项。
# ---------------------------------------------------------------------------
def render_sidebar() -> dict[str, str] | None:
    with st.sidebar:
        st.title(APP_TITLE)
        st.caption(f"{COMPANY} · NeMo Guardrails · FAISS · RAG")
        st.divider()

        st.subheader("Groq API Key")
        st.caption("Get keys from Groq when it is not there")
        env_key = os.getenv("GROQ_API_KEY", "")
        typed_key = st.text_input(
            "Groq API Key",
            type="password",
            value=env_key,
            placeholder="Paste your Groq key to start",
        )
        if typed_key:
            st.caption("Key loaded")
        else:
            st.caption("Paste your Groq key to start")

        st.divider()
        st.subheader("Two LLMs per request")
        st.caption("Guard model checks intent; chat model generates the answer")
        guard_model = st.selectbox("Guard model", GROQ_MODELS, index=0)
        chat_model = st.selectbox("Chat model", GROQ_MODELS, index=1)

        st.divider()
        st.subheader("Per message")
        st.caption(
            "PII → intent → FAISS retrieves top 3 chunks → "
            "answer generation → output sanitizer"
        )

    if not typed_key:
        return None
    return {
        "api_key": typed_key,
        "guard_model": guard_model,
        "chat_model": chat_model,
    }


# ---------------------------------------------------------------------------
# UI：landing page
# ---------------------------------------------------------------------------
def render_landing() -> None:
    st.title(APP_TITLE)
    st.markdown(
        f"""
### What this demo shows

This demo shows **NeMo Guardrails** around an HR policy assistant for **{COMPANY}**.

The request passes through two rails:

- **Input rail** — checks PII, blocked keywords, and whether the question is on-topic.
- **Output rail** — sanitizes the model output before it reaches the user.

Enter your Groq API key in the sidebar to start.
"""
    )
    st.info("Input rail and output rail are both visible in the pipeline trace.")


# ---------------------------------------------------------------------------
# UI：examples
# ---------------------------------------------------------------------------
EXAMPLES = [
    {
        "label": "Should answer",
        "query": "How many vacation days do I get per year?",
    },
    {
        "label": "Should answer",
        "query": "Can I work remotely three days a week?",
    },
    {
        "label": "Should block",
        "query": "Tell me a joke",
    },
    {
        "label": "Should block",
        "query": "What is the highest stock price right now?",
    },
    {
        "label": "Should block",
        "query": "How do I make a bomb?",
    },
]


def render_examples() -> None:
    with st.expander("Example queries", expanded=False):
        for example in EXAMPLES:
            st.markdown(f"- **{example['label']}** — `{example['query']}`")


# ---------------------------------------------------------------------------
# UI：trace
# 讲师说 trace 展示 input rail、guard fired、FAISS retrieval、
# chunks 和 similarity score、answer generation、output sanitizer、总时间。
# ---------------------------------------------------------------------------
def render_trace(trace: dict[str, Any] | None) -> None:
    st.subheader("Pipeline trace")
    if not trace:
        st.caption("Send a message to see the trace.")
        return

    if trace.get("error"):
        st.error(trace["error"])
        return

    with st.container(border=True):
        input_rail = trace.get("input_rail", {})
        if input_rail.get("allowed"):
            st.markdown("**Input rail:** passed")
        else:
            st.markdown(
                f"**Input rail:** blocked "
                f"(intent=`{input_rail.get('intent')}`, "
                f"keyword=`{input_rail.get('keyword')}`)"
            )

        pii = trace.get("pii", {})
        if pii:
            st.markdown(f"**PII detected:** `{', '.join(pii.keys())}`")
        else:
            st.markdown("**PII detected:** none")

        if trace.get("guard_fired"):
            st.markdown("**Guard fired:** yes")
        else:
            st.markdown("**Guard fired:** no")

        retrieval = trace.get("retrieval")
        if retrieval is None:
            st.caption("No retrieval for this message.")
        elif retrieval.get("failed"):
            st.error("Retrieval failed")
        else:
            st.markdown(
                f"**FAISS retrieval:** top {len(retrieval['chunks'])} chunks "
                f"in {retrieval['elapsed_ms']:.0f} ms"
            )
            for chunk in retrieval["chunks"]:
                st.markdown(
                    f"- `{chunk['score']:.4f}` — **{chunk['title']}**"
                )
                st.caption(chunk["content"])

        answer = trace.get("answer")
        if answer:
            st.markdown("**Answer generation:**")
            st.write(answer)

        sanitizer = trace.get("sanitizer")
        if sanitizer:
            st.markdown(
                f"**Output sanitizer:** "
                f"{'changed output' if sanitizer['changed'] else 'no change'}"
            )

        if trace.get("total_ms") is not None:
            st.divider()
            st.caption(f"Total time: {trace['total_ms']:.0f} ms")


# ---------------------------------------------------------------------------
# UI：chat tab
# ---------------------------------------------------------------------------
def render_chat_tab(
    settings: dict[str, str],
    vector_store: VectorStore,
) -> None:
    chat_column, trace_column = st.columns([3, 2])

    with chat_column:
        render_examples()

        if "chat" not in st.session_state:
            st.session_state.chat = []

        for message in st.session_state.chat:
            with st.chat_message(message["role"]):
                st.markdown(message["content"])

        prompt = st.chat_input("Ask an HR policy question")
        if prompt:
            st.session_state.chat.append({"role": "user", "content": prompt})
            with st.chat_message("user"):
                st.markdown(prompt)

            trace: dict[str, Any] = {
                "input_rail": {},
                "pii": {},
                "guard_fired": False,
                "retrieval": None,
                "answer": None,
                "sanitizer": None,
                "total_ms": None,
                "error": None,
            }
            started = time.perf_counter()

            try:
                # 1. PII 检查
                pii = detect_pii(prompt)
                trace["pii"] = pii

                # 2. 关键词 input rail
                allowed, intent, keyword = keyword_input_rail(prompt)
                trace["input_rail"] = {
                    "allowed": allowed,
                    "intent": intent,
                    "keyword": keyword,
                }

                # 3. guard model 意图判断
                if allowed:
                    client = Groq(api_key=settings["api_key"])
                    label = llm_intent_check(
                        client, settings["guard_model"], prompt
                    )
                    if label == "OFF_TOPIC":
                        allowed = False
                        trace["input_rail"] = {
                            "allowed": False,
                            "intent": "off_topic",
                            "keyword": "guard_model",
                        }

                if not allowed:
                    trace["guard_fired"] = True
                    answer = (
                        "Blocked by the input rail. "
                        "I can only answer HR policy questions."
                    )
                    trace["answer"] = answer
                else:
                    client = Groq(api_key=settings["api_key"])

                    # 4. 检索 top 3 chunks
                    retrieval_started = time.perf_counter()
                    try:
                        chunks = vector_store.search(prompt, top_k=TOP_K)
                        trace["retrieval"] = {
                            "failed": False,
                            "chunks": chunks,
                            "elapsed_ms": (
                                time.perf_counter() - retrieval_started
                            )
                            * 1000,
                        }
                    except Exception as exc:
                        trace["retrieval"] = {
                            "failed": True,
                            "error": str(exc),
                            "chunks": [],
                            "elapsed_ms": (
                                time.perf_counter() - retrieval_started
                            )
                            * 1000,
                        }
                        raise

                    # 5. answer generation
                    raw_answer = generate_answer(
                        client,
                        settings["chat_model"],
                        prompt,
                        trace["retrieval"]["chunks"],
                    )

                    # 6. output sanitizer
                    sanitized = mask_pii(raw_answer)
                    trace["sanitizer"] = {
                        "changed": sanitized != raw_answer,
                    }
                    trace["answer"] = sanitized
                    answer = sanitized

            except Exception as exc:
                trace["error"] = str(exc)
                answer = f"Pipeline error: {exc}"

            trace["total_ms"] = (time.perf_counter() - started) * 1000
            st.session_state.trace = trace
            st.session_state.chat.append(
                {"role": "assistant", "content": answer}
            )
            with st.chat_message("assistant"):
                st.markdown(answer)

    with trace_column:
        render_trace(st.session_state.get("trace"))


# ---------------------------------------------------------------------------
# UI：docs tab
# ---------------------------------------------------------------------------
def render_docs_tab() -> None:
    st.divider()
    st.subheader("HR Documents")
    st.caption("These documents are embedded into the vector store.")
    for document in HR_DOCUMENTS:
        with st.expander(document["title"]):
            st.markdown(document["content"])


# ---------------------------------------------------------------------------
# 入口
# ---------------------------------------------------------------------------
def main() -> None:
    st.set_page_config(page_title=APP_TITLE, layout="wide")

    if "chat" not in st.session_state:
        st.session_state.chat = []
    if "trace" not in st.session_state:
        st.session_state.trace = None
    if "vector_store" not in st.session_state:
        st.session_state.vector_store = None

    settings = render_sidebar()

    if not settings:
        render_landing()
        return

    if st.session_state.vector_store is None:
        with st.spinner("Building vector store..."):
            st.session_state.vector_store = build_vector_store()

    tab_chat, tab_docs = st.tabs(
        [f"{APP_TITLE} · Chat", "HR Documents"]
    )
    with tab_chat:
        render_chat_tab(settings, st.session_state.vector_store)
    with tab_docs:
        render_docs_tab()


if __name__ == "__main__":
    main()
```

### 4.5 `requirements-aws.txt`

P51 讲师说要装 `boto3`、`botocore`，JSON 是 Python 自带。下面不锁死小版本，避免 AWS 更新后装不上。

```text
boto3>=1.34,<2
botocore>=1.34,<2
```

### 4.6 `aws_guardrails_demo.py`

P51 讲师在 notebook 里演示了：配置两个 client、列模型、创建 guardrail、应用 guardrail。讲师没有逐行念出 notebook 代码，下面按这些动作写成 CLI 脚本。AWS API 的字段名以你实际运行输出为准；不要把这里的字段当成讲师逐字稿原话。

```python
# aws_guardrails_demo.py
# P51 最小实验：bedrock 控制面 + bedrock-runtime 数据面
# 运行前先执行 aws configure，region 建议 us-east-1。

import argparse
import json
import sys

import boto3
from botocore.exceptions import BotoCoreError, ClientError

REGION = "us-east-1"


def make_clients():
    # 讲师强调：bedrock 是控制客户端，bedrock-runtime 是数据客户端。
    control = boto3.client("bedrock", region_name=REGION)
    runtime = boto3.client("bedrock-runtime", region_name=REGION)
    return control, runtime


def cmd_models(args: argparse.Namespace) -> None:
    control, _ = make_clients()
    response = control.list_foundation_models()
    summaries = response.get("modelSummaries", [])
    needle = args.contains.lower()
    rows = []
    for model in summaries:
        model_id = model.get("modelId", "")
        if needle and needle not in model_id.lower():
            continue
        rows.append(
            {
                "modelId": model_id,
                "providerName": model.get("providerName", ""),
                "modelName": model.get("modelName", ""),
            }
        )
    print(json.dumps(rows, indent=2, ensure_ascii=False))
    print(f"\nMatched {len(rows)} model(s).", file=sys.stderr)


def build_guardrail_config() -> dict:
    """
    五大策略里，这里放四个最小配置：
    topic policy、content policy、word policy、sensitive information policy。
    grounding policy 只用于 RAG，而且只能挂输出，本最小脚本先不放。
    """
    return {
        "topicPolicyConfig": {
            "topicsConfig": [
                {
                    "name": "MedicalQuestions",
                    "definition": (
                        "Questions that ask for medical advice, diagnosis, "
                        "treatment, or medication recommendations."
                    ),
                    "examples": [
                        "What medicine should I take for a headache?",
                        "Do I have diabetes?",
                    ],
                    "type": "DENY",
                },
                {
                    "name": "LegalQuestions",
                    "definition": (
                        "Questions that ask for legal advice or legal interpretation."
                    ),
                    "examples": [
                        "Can I sue my landlord?",
                        "Is this contract legally binding?",
                    ],
                    "type": "DENY",
                },
            ]
        },
        "contentPolicyConfig": {
            "filtersConfig": [
                {
                    "type": "SEXUAL",
                    "inputStrength": "HIGH",
                    "outputStrength": "HIGH",
                },
                {
                    "type": "VIOLENCE",
                    "inputStrength": "HIGH",
                    "outputStrength": "HIGH",
                },
                {
                    "type": "HATE",
                    "inputStrength": "HIGH",
                    "outputStrength": "HIGH",
                },
                {
                    "type": "INSULTS",
                    "inputStrength": "HIGH",
                    "outputStrength": "HIGH",
                },
                {
                    "type": "MISCONDUCT",
                    "inputStrength": "HIGH",
                    "outputStrength": "HIGH",
                },
                {
                    "type": "PROMPT_ATTACK",
                    "inputStrength": "HIGH",
                    "outputStrength": "NONE",
                },
            ]
        },
        "wordPolicyConfig": {
            "wordsConfig": [
                {"text": "AcmeInternalSecret"},
            ],
            "managedWordListsConfig": [
                {"type": "PROFANITY"},
            ],
        },
        "sensitiveInformationPolicyConfig": {
            "piiEntitiesConfig": [
                {"type": "EMAIL", "action": "ANONYMIZE"},
                {"type": "CREDIT_DEBIT_CARD_NUMBER", "action": "BLOCK"},
            ],
            "regexesConfig": [
                {
                    "name": "EmployeeId",
                    "pattern": r"EMP-\d{6}",
                    "action": "ANONYMIZE",
                }
            ],
        },
    }


def cmd_create(args: argparse.Namespace) -> None:
    control, _ = make_clients()
    response = control.create_guardrail(
        name=args.name,
        description="Demo guardrail for the AI Security Bootcamp",
        blockedInputMessaging=(
            "Sorry, I can't help with that request."
        ),
        blockedOutputsMessaging=(
            "Sorry, I can't return that answer."
        ),
        **build_guardrail_config(),
    )
    print(json.dumps(response, indent=2, ensure_ascii=False, default=str))


def cmd_apply(args: argparse.Namespace) -> None:
    _, runtime = make_clients()
    response = runtime.apply_guardrail(
        guardrailIdentifier=args.guardrail_id,
        guardrailVersion=args.version,
        source=args.source,
        content=[
            {
                "text": {
                    "text": args.text,
                }
            }
        ],
    )
    print(json.dumps(response, indent=2, ensure_ascii=False, default=str))


def cmd_list(args: argparse.Namespace) -> None:
    control, _ = make_clients()
    response = control.list_guardrails()
    print(json.dumps(response, indent=2, ensure_ascii=False, default=str))


def cmd_delete(args: argparse.Namespace) -> None:
    control, _ = make_clients()
    response = control.delete_guardrail(
        guardrailIdentifier=args.guardrail_id,
    )
    print(json.dumps(response, indent=2, ensure_ascii=False, default=str))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="AWS Bedrock Guardrails minimal demo"
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    models = subparsers.add_parser("models", help="List Bedrock models")
    models.add_argument(
        "--contains",
        default="nova",
        help="Filter by substring in modelId, e.g. nova, claude, sonnet, opus, llama",
    )
    models.set_defaults(func=cmd_models)

    create = subparsers.add_parser("create", help="Create a guardrail")
    create.add_argument("--name", required=True)
    create.set_defaults(func=cmd_create)

    apply_parser = subparsers.add_parser(
        "apply", help="Apply a guardrail to text"
    )
    apply_parser.add_argument("--guardrail-id", required=True)
    apply_parser.add_argument("--version", default="DRAFT")
    apply_parser.add_argument(
        "--source", choices=["INPUT", "OUTPUT"], default="INPUT"
    )
    apply_parser.add_argument("--text", required=True)
    apply_parser.set_defaults(func=cmd_apply)

    list_parser = subparsers.add_parser("list", help="List guardrails")
    list_parser.set_defaults(func=cmd_list)

    delete = subparsers.add_parser("delete", help="Delete a guardrail")
    delete.add_argument("--guardrail-id", required=True)
    delete.set_defaults(func=cmd_delete)

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    try:
        args.func(args)
    except (BotoCoreError, ClientError) as exc:
        print(f"AWS error: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
```

---

## 5. 逐行解释

### 5.1 `app.py` 为什么这样写

**`st.set_page_config(page_title=APP_TITLE, layout="wide")`**  
讲师在 P50 说 page title 是 HR policy assistant，layout 是 wide。`layout="wide"` 的作用是把 Streamlit 默认的窄居中布局改成宽屏，否则 chat 和 trace 两列会挤在一起。

**`st.session_state.chat` / `st.session_state.trace`**  
讲师说“如果 chat 不在 session state 里，就初始化 session state，保持聊天历史”。Streamlit 每次交互都会从头执行整个脚本，普通变量会丢；`session_state` 是跨 rerun 保存的字典。  
如果你从 JS/Node 转过来：它有点像浏览器里的全局 store，但只存在当前用户会话里，不是数据库，也不是 Redis。刷新页面或换浏览器就没了。

**`render_sidebar()` 返回 `dict | None`**  
讲师说 sidebar 返回 Groq model、guard model、chat model；如果 key 没提供，就不渲染 landing page 后面的内容。代码里 `if not typed_key: return None` 就是实现这个判断：没有 key 时 `main()` 只调用 `render_landing()`，不会构建向量库，也不会进入 chat。

**`st.text_input(..., type="password")`**  
讲师明确说 `type` 是 `password`，所以输入内容被隐藏。placeholder 写“Paste your Groq key to start”，对应讲师说的 help 提示。

**两个 `st.selectbox`**  
讲师说“两个 LLM per request”：guard model 和 chat model。代码里两个 selectbox 都从 `GROQ_MODELS` 取，对应讲师说的“Grok models we are fetching it from our config variables”。注意：讲师说的是 Groq，不是 xAI 的 Grok；这里不要混淆。

**`st.divider()` 和 `st.caption()`**  
讲师反复念 title、caption、divider 的结构。`st.divider()` 画横线，`st.caption()` 是小字说明。这些不是装饰，是为了让 sidebar 的信息层次和讲师屏幕一致。

**`render_landing()`**  
讲师说 landing page 讲 input rail 和 output rail，并说明这个 demo 展示 NeMo Guardrails 发生了什么。代码里用 markdown 写同样的信息，并加 `st.info` 提示 trace 里能看到两条 rail。

**`render_examples()`**  
讲师说 examples 要有“应该回答”和“应该 block”的不同条件。`EXAMPLES` 里前两条是 HR 问题，后三条分别覆盖 off-topic、股票、危险请求。这样你点开 expander 就能按讲师演示的顺序测试。

**`render_trace()` 的分支**  
讲师说：没有 trace 就提示“Send a message to see the trace”；有错误就显示错误；没有错误就显示 input rail、guard fired、FAISS retrieval、chunks、answer generation、output sanitizer、总时间。代码里按这个顺序逐段判断。  
`trace.get("retrieval") is None` 表示这条消息被 input rail 拦截了，没有进入检索，所以显示“No retrieval for this message.”。`retrieval.get("failed")` 对应讲师说的“如果检索失败就显示 retrieval failed”。

**`VectorStore.build()`**  
讲师说必须 build vector store，因为 HR documents 要变成向量。代码里先 `TextEmbedding(model_name="BAAI/bge-small-en-v1.5")` 加载 FastEmbed 模型，再对每篇文档的 `content` 生成向量。第一次运行会下载模型权重，这就是讲师演示时“要等一分钟”的原因。  
`norms = np.linalg.norm(..., axis=1, keepdims=True)` 做 L2 归一化，归一化后点积等于余弦相似度。这样 `self.embeddings @ query_vector` 得到的就是 similarity score。

**`VectorStore.search()` 的 `top_k=3`**  
讲师说“FAISS retrieves top three chunks”，代码里 `TOP_K = 3`。`np.argsort(-scores)[:top_k]` 取分数最高的三个。返回的每个 chunk 都带 `title`、`content`、`score`，对应讲师说的“chunks 会带着相似度分数展示”。

**`detect_pii()` 和 `mask_pii()`**  
讲师说 per message 会检查 PII，output sanitizer 也会处理。代码用三个正则：邮箱、13–16 位数字（信用卡）、6 位数字（OTP）。  
这是演示级正则，不是生产级 PII 检测。生产里信用卡号有 Luhn 校验，OTP 长度也不止 6 位，邮箱正则也有边界情况。课里没讲生产级实现，这里只保证 demo 能演示“检测到并脱敏”。

**`keyword_input_rail()`**  
讲师演示 “Tell me a joke” 被 block，trace 显示 guard fired。代码里 `off_topic` 关键词包含 `joke`，所以这条会命中。`harmful` 关键词包含 `bomb`，对应讲师说的“如何制造炸弹”被拦截的例子。  
注意：关键词 rail 只是第一层，它便宜、快，但容易误杀。比如用户问“公司有没有关于 bomb threat 的应急政策”，也会被拦。生产里要配合白名单或更细的意图分类。

**`llm_intent_check()`**  
讲师说“two LLMs per request”，一个 guard model 一个 chat model。这里用 guard model 做 HR_TOPIC / OFF_TOPIC 二分类。`max_tokens=5` 是为了让模型只输出一个短标签，减少成本和延迟。  
`except Exception: return "HR_TOPIC"` 是兜底：如果 guard model 调用失败，不要因为护栏本身挂掉而让整个应用不可用。这是一个工程取舍，课里没有明确讲，但你在实际项目里一定会遇到。

**`generate_answer()`**  
把检索到的 chunk 拼成 context，system prompt 要求“只能根据 context 回答，不知道就说不知道”。这是最基础的 RAG 生成。讲师说主要目标不是 RAG，而是展示 use case，所以这里没有做 rerank、没有做 citation、没有做多轮改写。

**`render_chat_tab()` 的处理顺序**  
和讲师 sidebar 里写的 per message 顺序一致：PII → intent → FAISS top 3 → answer generation → output sanitizer。  
每一步都写入 `trace`，最后 `st.session_state.trace = trace`，右列 `render_trace()` 读取。这样左边聊天、右边 trace，对应讲师说的“chat 和 trace 两列”。

**`st.chat_input()` 和 `st.chat_message()`**  
这是 Streamlit 的聊天组件。`st.chat_input` 是底部输入框，`st.chat_message("user")` / `st.chat_message("assistant")` 是气泡。讲师在视频里没有逐行讲这两个 API，但界面效果就是这两个组件做出来的。

**`main()` 里的 `st.spinner("Building vector store...")`**  
第一次构建向量库会下载模型、生成 embedding，可能几十秒到几分钟。加 spinner 是为了让用户知道程序没死。讲师演示时也出现了等待，并解释“内部在下载 fast embed 模型”。

**`if __name__ == "__main__": main()`**  
`streamlit run app.py` 会执行整个文件，这个入口保证 `main()` 被调用。Streamlit 不需要 Flask 那种 `app.run()`。

### 5.2 `aws_guardrails_demo.py` 为什么这样写

**`boto3.client("bedrock", region_name=REGION)`**  
讲师说 `bedrock` 是控制客户端，用来创建、删除、列出、获取 guardrail。代码里 `cmd_create`、`cmd_list`、`cmd_delete` 都用这个 client。

**`boto3.client("bedrock-runtime", region_name=REGION)`**  
讲师说 `bedrock-runtime` 是数据客户端/实际 worker，用来实际使用 guardrail、调用模型、应用 guardrail。代码里 `cmd_apply` 用这个 client 调 `apply_guardrail`。

**`REGION = "us-east-1"`**  
讲师明确推荐 `us-east-1`，并说完全支持的区域包括 `us-east-1`、`us-west-2`、`eu-east-1`、`ap-southeast-1`。代码里写死 `us-east-1`，你如果要换区域，改这个常量，同时 `aws configure` 里的 region 也要一致。

**`list_foundation_models()`**  
讲师说他在 notebook 里“列出所有模型”，并用 model id 里的 `nova`、`claude`、`sonnet`、`opus`、`llama` 做过滤，验证连接是否成功。代码里 `--contains nova` 就是做这件事。  
注意：`list_foundation_models` 返回的字段名以实际输出为准；代码里用了 `modelSummaries`、`modelId`、`providerName`、`modelName`，如果你账号返回的结构不同，以 AWS 实际响应为准。

**`create_guardrail()` 的四个策略配置**  
- `topicPolicyConfig`：对应讲师说的 topic policy，自定义主题，给 `name`、`definition`、`examples`、`type: DENY`。讲师说“定义就是 prompt，再给一些例子，让 AI 知道要避免什么”。  
- `contentPolicyConfig`：对应讲师说的 AWS 预定义过滤器：sexual、violence、hate、insult、misconduct、prompt attack。讲师说这些不需要你定义 examples。  
- `wordPolicyConfig`：对应讲师说的 word policy，屏蔽特定词或短语。代码里放了自定义词 `AcmeInternalSecret` 和 AWS 托管脏话列表 `PROFANITY`。  
- `sensitiveInformationPolicyConfig`：对应讲师说的 sensitive information，可以 block 也可以 mask。代码里邮箱用 `ANONYMIZE`，信用卡用 `BLOCK`，还有一个员工
ID 的正则用 `ANONYMIZE`。  
讲师在 P51 说 sensitive information 既可以 block 也可以 mask，并且举了信用卡、CVV、OTP 的例子。代码里 `EMAIL` 和 `EmployeeId` 用 `ANONYMIZE`（脱敏，保留结构但替换内容），`CREDIT_DEBIT_CARD_NUMBER` 用 `BLOCK`（直接拒绝）。  
这里有一个讲师没有展开、但你在 AWS 控制台一定会看到的点：`action` 的取值不是随便写的字符串，必须是 AWS 支持的枚举。`ANONYMIZE` 和 `BLOCK` 是其中两个，具体还有哪些、大小写是否敏感，以你账号里 `create_guardrail` 的报错信息为准。课里没讲枚举全集，不要凭印象补。

**`groundingPolicyConfig` 为什么没放进 `build_guardrail_config()`**  
讲师说 grounding policy 是 RAG 场景用的，而且“只能附加到输出，不能附加到输入”。这个最小脚本的 `apply` 子命令同时支持 `--source INPUT` 和 `--source OUTPUT`，如果我把 grounding 配置塞进去，用户用 `--source INPUT` 调的时候就会撞上 AWS 的校验错误。  
所以这里刻意只放四个策略，把 grounding 留到你自己接 RAG 时再加。这是工程取舍，不是讲师原话；讲师原话只是说“grounding policy 只能挂输出”。

**`apply_guardrail()` 的 `content` 参数**  
代码里写的是：

```python
content=[
    {
        "text": {
            "text": args.text,
        }
    }
]
```

这是 `apply_guardrail` 的内容块格式：外层 `content` 是列表，每个元素是一个“内容类型”，`text` 里再包一层 `text`。  
这个双层结构很容易写错，因为看起来像重复了。你在实际调用时如果报参数校验错误，先检查这里是不是少了一层或者多了一层。字段名以你实际 SDK 版本的报错为准。

**`guardrailVersion=args.version` 默认 `DRAFT`**  
AWS Guardrail 有版本概念：你创建出来的是 `DRAFT` 版本，可以反复改；要固定下来给别人用，需要创建带版本号的正式版本。  
讲师在 P51 没有讲版本管理，只讲了创建和应用。代码里默认 `DRAFT` 是为了让你改完配置立刻能测，不用每次发布版本。生产里应该用正式版本号，否则你改一次 DRAFT，所有调用方行为都跟着变。

**`blockedInputMessaging` / `blockedOutputsMessaging`**  
这两个是当 guardrail 拦截时返回给用户的文案。讲师在 P51 说“我们可以显示消息说，抱歉，我们不能给你关于那个的指令”，对应这两个字段。  
代码里输入和输出用了不同文案，因为输入被拦和输出被拦对用户来说是两种体验：输入被拦是“你不该问”，输出被拦是“模型不该答”。

**`cmd_models` 里的 `print(..., file=sys.stderr)`**  
模型列表打到 stdout，方便你管道给 `jq` 或存文件；匹配数量打到 stderr，这样不会污染 JSON 输出。这是 CLI 脚本的常见写法，讲师没有讲，但你在实际用的时候会需要。

**`except (BotoCoreError, ClientError)`**  
`ClientError` 是 AWS 返回了错误响应（比如权限不足、参数不合法），`BotoCoreError` 是客户端层面的错误（比如网络、配置）。两个都捕获，打印后 `sys.exit(1)`，这样在 shell 里能用 `$?` 判断成功失败。  
如果你在 CI 里跑这个脚本，退出码很重要；讲师在 notebook 里跑，所以没有强调这一点。

**`argparse` 的 `subparsers(dest="command", required=True)`**  
`required=True` 保证你必须写子命令，不写就报错，而不是静默什么都不做。这是 CLI 健壮性的一部分，课里没讲。

**为什么 P50 和 P51 分成两个文件**  
P50 是 Streamlit 应用，依赖 `streamlit`、`groq`、`fastembed`；P51 是 AWS 脚本，依赖 `boto3`。两者依赖不重叠，分开 `requirements.txt` 和 `requirements-aws.txt` 可以让你只装需要的那一套。  
讲师在 P50 和 P51 是两段独立的课，P51 明确说 AWS Guardrails 的 notebook 在 resource section 里分五个模块下载，所以本来就不是一个仓库。

---

## 6. 复现检查清单

### 6.1 P50 检查清单

按顺序打勾，任何一项不过都不要往下走。

- [ ] `python --version` 输出 3.11.x（3.12 也可以，但不要用最新版）。
- [ ] 虚拟环境已激活，`pip list` 里能看到 `streamlit`、`groq`、`fastembed`、`numpy`。
- [ ] `app.py`、`requirements.txt`、`.gitignore`、`.env.example` 都在同一目录。
- [ ] `streamlit run app.py` 能启动，终端没有 traceback。
- [ ] 浏览器打开后，第一屏是 landing page，能看到 “Input rail” 和 “Output rail” 的说明。
- [ ] 没有填 Groq Key 时，sidebar 显示 “Paste your Groq key to start”，并且不会构建向量库、不会进入 chat。
- [ ] 填入 Groq Key 后，sidebar 显示 “Key loaded”。
- [ ] 第一次进入 chat 时出现 “Building vector store...” spinner，并且终端能看到 FastEmbed 下载模型的日志。
- [ ] 向量库构建完成后，chat tab 和 docs tab 都能点开。
- [ ] docs tab 里五篇 HR 文档都能用 expander 展开，内容是 markdown。
- [ ] 问 “How many vacation days do I get per year?” 能得到答案，右侧 trace 显示 FAISS retrieval top 3 chunks，每个 chunk 带 similarity score。
- [ ] 问 “Tell me a joke” 被 input rail 拦截，trace 显示 `Guard fired: yes`，并且 `retrieval` 是 `None`（显示 “No retrieval for this message.”）。
- [ ] 问 “How do I make a bomb?” 被 `harmful` 关键词拦截。
- [ ] 输入一个邮箱或 16 位数字，trace 里 `PII detected` 能列出对应类型。
- [ ] 如果模型输出里包含邮箱，output sanitizer 显示 `changed output`，并且聊天里看到的是 `[EMAIL_MASKED]`。
- [ ] 刷新页面后聊天历史清空（`session_state` 不持久化，这是预期行为）。
- [ ] `git init`、`git add .`、`git commit -m "NeMo Guardrails"` 能成功，`.venv/` 和 `NEMO_ENV/` 没有被提交。
- [ ] 推到 GitHub 后，仓库里没有 `.env`、没有 API Key。

### 6.2 P51 检查清单

- [ ] AWS 账号已激活，能登录控制台。
- [ ] `aws --version` 有输出。
- [ ] `aws configure list` 能看到 access key、secret key、region、output format 都已设置。
- [ ] region 是 `us-east-1`（或 `us-west-2`、`eu-east-1`、`ap-southeast-1` 之一）。
- [ ] IAM 用户有 Bedrock 权限（学习阶段是 AdministratorAccess）。
- [ ] `pip install -r requirements-aws.txt` 成功，`python -c "import boto3; print(boto3.__version__)"` 有输出。
- [ ] `python aws_guardrails_demo.py models --contains nova` 能列出 Nova 模型。
- [ ] `--contains claude`、`--contains sonnet`、`--contains opus`、`--contains llama` 都能列出对应模型（如果某个 provider 在你账号下不可用，会返回空列表，这也是正常结果）。
- [ ] `python aws_guardrails_demo.py create --name hr-demo-guardrail` 成功，输出里有 guardrail 的 id 和 version。
- [ ] `python aws_guardrails_demo.py list` 能看到刚创建的 guardrail。
- [ ] `python aws_guardrails_demo.py apply --guardrail-id <你的ID> --version DRAFT --source INPUT --text "What medicine should I take for a headache?"` 返回被 topic policy 拦截。
- [ ] `--source INPUT --text "Can I sue my landlord?"` 返回被 legal topic 拦截。
- [ ] `--source INPUT --text "AcmeInternalSecret"` 返回被 word policy 拦截。
- [ ] `--source INPUT --text "my email is test@example.com"` 返回 `ANONYMIZE` 后的文本。
- [ ] `--source INPUT --text "4111 1111 1111 1111"` 返回被 sensitive information policy 拦截。
- [ ] `--source OUTPUT --text "..."` 能正常调用（grounding 没配，所以不会因为 grounding 报错）。
- [ ] `python aws_guardrails_demo.py delete --guardrail-id <你的ID>` 能删除，`list` 里消失。
- [ ] 如果任何一步报 `AccessDeniedException`，回到 IAM 检查权限；如果报 `ValidationException`，检查 region 和参数枚举。

### 6.3 两个项目共同的检查

- [ ] 所有命令都在项目根目录执行，没有 `cd` 到别的目录导致找不到文件。
- [ ] 没有把 API Key、AWS access key 写进代码或提交到 git。
- [ ] 终端里的报错能对应到本文档的某一节；如果对应不上，先看第 7 节。

---

## 7. 课里没讲但你会撞上的

这一节写的都是逐字稿和截图里没有、但你照着做一定会遇到的问题。不是讲师漏讲，是课程定位是“理解概念”，工程细节要你自己补。

### 7.1 P50 相关

**FastEmbed 第一次下载会卡住**  
`TextEmbedding(model_name="BAAI/bge-small-en-v1.5")` 第一次运行会从 Hugging Face 下载模型权重。如果你在国内网络环境，可能卡在下载。  
课里没讲代理配置。实际做法是设置 `HF_ENDPOINT` 环境变量指向镜像，或者提前把模型缓存到本地。缓存目录默认在 `~/.cache/fastembed`（Linux/macOS）或 `%USERPROFILE%\.cache\fastembed`（Windows）。

**Streamlit 每次交互都重跑整个脚本**  
这是 Streamlit 的核心模型，不是 bug。你在 `main()` 里写的任何“初始化”代码，每次用户点按钮都会再执行一遍。所以向量库必须放 `st.session_state`，否则每次发消息都重新 build 一次，慢到不可用。  
从 JS/React 转过来可以理解为：Streamlit 没有组件级状态，只有“整个页面重渲染 + session_state 持久化”。

**`st.session_state` 不是多用户共享的**  
每个浏览器会话有独立的 `session_state`。两个用户同时打开，聊天历史互不影响。但这也意味着你不能用它做“全局配置”，全局配置要用 `st.cache_resource` 或环境变量。  
课里没讲 `st.cache_resource`，但如果你把 `VectorStore` 放进去，多个会话可以共享同一个向量库，省内存。代价是首次构建的锁竞争，需要自己处理。

**Groq 的 rate limit**  
`llm_intent_check` 每条消息调一次 guard model，`generate_answer` 再调一次 chat model，一条消息两次 API 调用。免费额度下很容易撞 429。  
课里没讲重试。实际做法是加指数退避，或者把关键词 rail 放在前面，命中就不调模型。本文代码已经是这个顺序：先 `keyword_input_rail`，没命中才调 `llm_intent_check`。

**`llm_intent_check` 的兜底会放行**  
代码里 `except Exception: return "HR_TOPIC"`，意思是 guard model 挂了就放行。这是“可用性优先”的取舍。  
如果你的场景是“安全优先”，应该改成 `return "OFF_TOPIC"`，宁可误杀不可放过。课里没讲这个取舍，但这是安全系统里必须做的决定。

**PII 正则的误杀**  
`\b\d{6}\b` 会把订单号、验证码、邮编都当成 OTP。`\b(?:\d[ -]*?){13,16}\b` 会把长数字串都当成信用卡。  
生产里要做 Luhn 校验、要区分上下文。课里没讲，demo 里也没做。

**FAISS 在本文代码里其实没用**  
讲师口播里反复说 “FAISS”，但本文为了减少依赖，用 numpy 做余弦相似度。两者在 top-k 检索上结果一致（小数据量下），但 FAISS 有 IVF、HNSW 等索引，大数据量下快几个数量级。  
如果你要严格复现讲师的 FAISS，需要 `pip install faiss-cpu`，然后把 `VectorStore.search` 换成 `faiss.IndexFlatIP`。课里没给 FAISS 的具体代码，所以本文没有强行加。

**`st.chat_input` 在 sidebar 展开时会挡住内容**  
Streamlit 的 `chat_input` 固定在页面底部，如果 sidebar 很长，滚动时可能视觉上重叠。这是 Streamlit 的布局特性，不是代码问题。  
课里没讲，实际调一下 `st.container(height=...)` 或者减少 sidebar 内容即可。

### 7.2 P51 相关

**`aws configure` 的 region 和代码里的 `REGION` 必须一致**  
`aws configure` 设置的是 CLI 默认 region，`boto3.client(region_name=REGION)` 是代码里显式指定。两者不一致时，CLI 命令和 Python 脚本会打到不同 region，出现“CLI 能创建、Python 找不到”的诡异现象。  
本文代码写死 `us-east-1`，所以你 `aws configure` 也要选 `us-east-1`。课里没强调这个一致性，但这是最常见的坑。

**IAM 的 region 是 global**  
讲师在 P51 说“在 IAM 区域里不能改 region，它是 global”。这是对的：IAM 用户、权限、access key 都是全局资源，不随 region 变。  
但 Bedrock 的 guardrail 是 regional 资源，`us-east-1` 创建的 guardrail 在 `us-west-2` 看不到。所以 `apply_guardrail` 的 client 必须和创建时同 region。

**`create_guardrail` 的 `name` 有字符限制**  
AWS 对 guardrail name 有长度和字符集限制（通常只允许字母、数字、连字符、下划线）。本文代码没做校验，你传中文或特殊字符会报 `ValidationException`。  
课里没讲，实际用英文短横线命名最稳。

**`apply_guardrail` 的返回结构**  
返回里通常有 `action`（`GUARDRAIL_INTERVENED` 或 `NONE`）、`outputs`、`assessments` 等字段。本文代码直接 `json.dumps` 打印，没有解析。  
你要做自动化测试的话，需要读 `action` 字段判断是否拦截。字段名以实际输出为准，课里没讲。

**`DRAFT` 版本不能直接给生产用**  
前面说过，`DRAFT` 是可变的。AWS 的正式做法是 `create_guardrail_version` 发布一个不可变版本，然后用版本号调用。  
课里没讲版本发布，但你在控制台点“Create version”就会看到。生产里必须用正式版本，否则改配置会影响所有调用方。

**Grounding policy 需要 RAG 上下文**  
`groundingPolicyConfig` 不是给一段文本就能测的，它需要 `context` 和 `query` 的对应关系。本文代码没配 grounding，就是因为最小脚本没有 RAG 上下文。  
你要测 grounding，需要构造 `content` 里带 `guardContent` 的结构，具体格式以 AWS 文档为准。课里说“grounding 的实践在第五个模块”，但逐字稿没有展开。

**Bedrock 模型访问权限**  
`list_foundation_models` 能列出模型，不代表你有权限 `invoke_model`。有些模型需要在控制台点“Request access”才能调用。  
讲师说 Nova 不需要申请，Claude 需要提交 use case 表单。这是对的，但即使是 Nova，如果你的 IAM 权限不够，`invoke_model` 也会 `AccessDeniedException`。  
本文脚本只调 `apply_guardrail`，不调 `invoke_model`，所以不受影响；但你要接模型生成答案时就会撞上。

**费用**  
Guardrail 本身按“每 1000 个文本单元”计费，`apply_guardrail` 调用也计费。学习阶段免费额度够用，但不要写死循环狂调。  
课里没讲计费细节，实际以 AWS 账单页为准。

**`boto3` 版本和 API 字段**  
AWS 的 API 会演进，`boto3` 旧版本可能不认识新字段（比如某个新策略类型）。本文 `requirements-aws.txt` 用 `>=1.34` 是为了拿到较新的字段支持。  
如果你装的是系统自带的旧 `boto3`，`create_guardrail` 可能报“未知参数”。先 `pip install -U boto3` 再试。

**Node/JS 对应物**  
你从 JS 转过来，如果要在 Node 里做同样的事，对应的是 `@aws-sdk/client-bedrock` 和 `@aws-sdk/client-bedrock-runtime`。  
概念完全一样：`BedrockClient` 是控制面，`BedrockRuntimeClient` 是数据面。`applyGuardrail` 是 runtime 上的方法。  
课里没讲 Node SDK，但 AWS SDK for JavaScript v3 的命名和 Python 是一一对应的。

**并发与锁**  
本文两个项目都没有并发写共享状态的问题：Streamlit 每个会话独立，AWS 脚本是单次 CLI 调用。  
如果你要把 `VectorStore` 做成多进程共享（比如 FastAPI 后面挂多个 worker），就需要考虑构建时的锁，避免多个 worker 同时下载模型。Node 里对应的是 `async-mutex` 或文件锁 `proper-lockfile`。  
课里没讲，因为课程定位是单机 demo。

**日志与可观测性**  
P50 的 trace 是“给用户看的”，不是“给运维看的”。生产里你需要把 trace 打到结构化日志（JSON），接 OpenTelemetry 或 CloudWatch。  
课里没讲，但这是 AI 应用工程师的下一步：demo 的 trace 是内存里的 dict，生产的 trace 要能检索、能告警、能关联 request id。

**安全边界**  
P50 的 guardrail 是应用层关键词 + LLM 意图分类，P51 的 guardrail 是 AWS 托管策略。两者不是替代关系：  
- 应用层 guardrail 灵活、便宜、可定制，但容易被绕过（改个说法就过了）。  
- AWS guardrail 有预训练模型、有持续更新，但配置复杂、有延迟、按量计费。  
生产里通常两层都上：应用层做快速拦截和业务规则，云托管做兜底和合规。  
课里没讲这个组合策略，但这是你做完这两个 demo 后最该想清楚的事。