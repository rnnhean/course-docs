# Context Engineering Masterclass（P029–P031）复现文档

> 本文覆盖 P029（聊天机器人记忆系统）、P030（Agent 上下文基础与两种失效模式）、P031（工具上下文管理与四大压缩策略）。P029 是可直接运行的完整项目；P030 是概念与预算推导；P031 是可直接运行的演示脚本。三节连起来，正好是「记忆 → Agent 上下文 → 工具上下文」的递进。

---

## 1. 这一节做什么

这三节课把前面讲过的上下文工程策略落成两个可运行的东西：

1. **P029：一个跨会话记忆的聊天机器人。** 用户第一次进来告诉它「我叫 Sarah，我是软件开发者，想买 1500 美元以内的笔记本」，会话结束后系统把事实抽取出来、持久化成 JSON；第二次开新会话时，机器人能主动说「又见面了 Sarah，笔记本找得怎么样了，还在 MacBook 和其他选项之间纠结吗，预算 1500」。它由五个组件拼成：`ConversationManager`（滑动窗口 + 轻量摘要）、`MemoryExtractor`（规则版 / LLM 版两种可互换策略）、`MemoryStore`（JSON 持久化）、`MemoryRetriever`（查询相关 + 永远包含）、以及把它们串起来的 `Chatbot`。

2. **P030：Agent 上下文为什么比普通 LLM 调用难管。** 讲师给出 Agent 的五种上下文类型（任务 / 工具 / 状态 / 记忆 / 协调），并推导出两种失效模式：**上下文退化（degradation）** 和 **硬溢出（overflow）**，核心结论是「退化远早于溢出发生，上下文管理是质量问题不是容量问题」，并用一个 128k 窗口的预算算式说明为什么工具密集的 Agent 实际只有约 20 轮可用。

3. **P031：工具上下文管理。** 工具吃掉 60–80% 的上下文预算，所以管好工具就解决了大部分问题。给出四个策略：动态工具加载、工具结果压缩、结构化调用上下文、错误上下文处理，并写成一个可运行的 `ToolContextManager` 演示脚本，实测总节省约 89.4%。

---

## 2. 讲师原话

> "现在我们要把学到的关于记忆的一切拼起来，为一个聊天机器人构建一套记忆系统。这是一个 demo，但它会向你展示那些策略、那些部件是如何组合到一起的。"
> —— p029 [00:00]

> "对话管理器会把处理过程中的信息片段交给记忆抽取器。记忆抽取器顾名思义，抽取事实、抽取它需要的所有片段，然后把它们放进一个很好的数据类实体里，这个实体组织用户画像，再把它加进记忆。这里的记忆我们会持久化成 JSON。但正如之前说过的，在生产级应用里，你应该存进数据库。"
> —— p029 [00:28]

> "我们会有两种抽取方式。一种是基于规则的，我们自己用代码手写。这很好，因为它快、免费、没有 API 调用，这样你可以做单元测试。但它只能捕获预期内的模式，因为规则得我们自己写。"
> —— p029 [01:56]

> "然后是 LLM 驱动的。它会用一个大语言模型，这里可以用 Claude，也可以用 OpenAI 的模型，无所谓。它会决定记住什么，能捕获意料之外的事实。当然，每次都要一次 API 调用，所以它灵活，但显然要花钱。"
> —— p029 [02:19]

> "记忆检索器负责查询相关内容，加上永远包含的策略。聊天机器人拿到这些信息作为上下文，把所有组件整合起来。"
> —— p029 [03:32]

> "Agent 不只是会调函数的 LLM，它们是自主系统，每一个动作都会累积上下文。如果你不仔细管理这些上下文，你的 Agent 要么忘了自己在干什么，要么没有思考的空间了。"
> —— p030 [00:00]

> "标准 LLM 调用的问题是上下文通常是静态的、单轮的、非常可预测的。而 Agent 这边，上下文是动态的，是多轮的，而且带有不可预测性。"
> —— p030 [01:03]

> "每一次工具调用，工具调用本身可能 50 到 200 token；工具返回的结果可能 100 到 10000 token；中间的任何推理过程也会加上 50 到 200 token。"
> —— p030 [02:41]

> "Agent 上下文有五种类型：任务上下文、工具上下文、状态上下文、记忆上下文、协调上下文。合起来就是我们说的 Agent 上下文栈。"
> —— p030 [03:09]

> "有两种不同的失效方式，而且它们发生在完全不同的尺度上。第一种叫上下文退化。到第 15 轮我们可能有 15000 多 token，这时候退化就开始了。为什么？因为 Agent 忘了它最初的任务。不是因为它没空间了，而是因为任务被埋在几千 token 的工具输出下面了。"
> —— p030 [04:39]

> "第二种失效是硬溢出。你确实把窗口耗尽了，模型看不到最早的几轮了。关键洞察是：退化远在溢出之前就会咬你。一个一百万 token 窗口的模型，在 15000 token 的任务上不会溢出，但它完全可以丢掉线索。所以上下文管理是质量问题，不只是容量问题。"
> —— p030 [06:47]

> "把上下文想成电脑里的 RAM。现代窗口很大，小模型 200k，前沿模型（比如 Claude、Gemini）能到 100 万以上。但更大的窗口并不能让这个问题消失。"
> —— p030 [07:11]

> "在大多数 Agent 系统里，工具实际上消耗了总上下文预算的 60% 到 80%。不是任务，不是推理，是工具——工具 schema、工具调用、工具结果。这告诉我们：把工具上下文管理好，你就解决了 Agent 上下文问题的大部分。"
> —— p031 [00:00]

> "如果你有 10 个工具，每个工具 200 token，那一下子就是 2000 token 出去了。"
> —— p031 [00:20]

> "如果你只加载相关的上下文，你会看到所需 token 量能减少最多 73%。动态工具加载就是解决方案。"
> —— p031 [01:32]

> "工具结果压缩：结果回来之后我们压缩它，从大量 token 压到不丢失重要上下文、更小、可管理、可以保存。"
> —— p031 [02:57]

> "一次网页搜索可能返回 15000 token 的搜索结果、摘要、元数据。15000 token 会炸掉 Agent 的上下文窗口。解决方案是先做确定性的、基于规则的压缩：保留前几行加 URL。这是代码写死的，所以免费、可预测。然后再过一遍 LLM 做摘要、抽取关键发现。两者结合，你能从 15000 压到大约 800 token，节省接近 95%。"
> —— p031 [03:17]

> "这些策略会协同工作：动态工具加载只加载当前任务需要的工具，然后把这些结果压缩，压缩时也可以走一遍大模型，或者用基于规则的压缩，就这样循环。典型节省是 70% 到 90%，甚至更高。"
> —— p031 [05:00]

> "结构化调用：把工具调用格式化后再进上下文。可以从 500 降到 150，节省 70%。错误处理也可以从 500 降到 100，节省约 80%。全部实现下来，典型总节省在 70% 到 90%。"
> —— p031 [06:08]

> "四个策略：动态工具加载、结果压缩、结构化调用、错误处理。把它们放在一起，能帮你省下最多 90%。"
> —— p031 [14:47]

---

## 3. 从零复现

### 3.1 环境准备

课里用的是 Python（`dataclass`、`json`、`pathlib` 风格）。讲师没有在逐字稿里念出依赖版本，下面给出的是能跑通本文代码的最小环境，**版本号请以你本地实际安装为准**：

```bash
# 建议 Python 3.10+（用到 dataclass 与类型注解）
python3 --version

# 创建虚拟环境
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# 安装依赖（P029 的 LLM 抽取器与 P031 的 LLM 压缩升级需要）
pip install anthropic
```

环境变量（P029 的 LLM 抽取器、P031 的 LLM 压缩升级都要用）：

```bash
export ANTHROPIC_API_KEY="sk-ant-..."   # Windows PowerShell: $env:ANTHROPIC_API_KEY="sk-ant-..."
```

> 课里没讲具体用哪个 SDK 方法名、哪个模型字符串之外的细节；讲师只说了「用 Claude Haiku，因为更便宜更快」。下面代码里模型名写成 `claude-3-5-haiku-latest` 这类占位，**请以你账号实际可用的模型 ID 为准**。

### 3.2 目录结构

```
context-engineering/
├── p029_chatbot_memory/
│   ├── models.py              # Message / Memory / UserProfile 数据模型
│   ├── conversation.py        # ConversationManager：滑动窗口 + 摘要
│   ├── store.py               # MemoryStore：JSON 持久化
│   ├── extractors.py          # RuleBasedExtractor / LLMExtractor
│   ├── retriever.py           # MemoryRetriever：查询相关 + 永远包含
│   ├── chatbot.py             # Chatbot：组装全部组件
│   └── main.py                # 两段会话的 demo
└── p031_tool_context/
    └── tool_context_manager.py  # 四大策略 + demo
```

### 3.3 P029 复现步骤

**第 1 步：定义数据模型。** 讲师在 [04:41] 说「这里有一些数据模型，给 message 和 memory 用，我们有 user profile，还有 add memory 之类的函数，要确保筛一遍、不要重复保存同一个东西，那会让记忆膨胀」。所以 `UserProfile.add_memory` 必须做去重。

**第 2 步：写 ConversationManager。** [05:09]：「包含滑动窗口加上我们之前讲过的轻量摘要，就这些。有 add、summarize_old、getContext 这些函数，然后返回真正的上下文。」窗口大小讲师在 Chatbot 里给了 `max_turns 10`（[06:32]）。

**第 3 步：写 MemoryStore。** [05:38]：「我们在这里持久化。生产环境必须用数据库，但这里可以就用本地临时的 JSON 记忆。」路径在 demo 里是 `chatbot_memory.json`（[07:02] 提到「path to our chatbot main with JSON」）。

**第 4 步：写两个抽取器。** 规则版在 [02:19] 给了例子：「如果我们在找名字，如果某个名字在 message 对象里，就会走这条规则」。LLM 版用 Claude Haiku（[06:06]）。

**第 5 步：写 MemoryRetriever。** [06:06]：「查询相关 + 永远包含。它负责挑哪些记忆注入当前轮的上下文。这是非常非常重要的一块。」

**第 6 步：组装 Chatbot 并跑两段会话。** 第一段：Sarah 报名字、职业、预算、偏好；结束时打印「3 memories saved」。第二段：新会话，机器人应主动认出 Sarah 并提到 1500 预算和 MacBook。

### 3.4 P030 复现步骤（纯讲解，按推导复现）

这一节没有代码，按讲师的推导链复现：

1. **对比两种工作流。** 标准 LLM：请求 → 处理 → 响应，上下文静态、单轮、可预测。Agent：查询 → 任务 → 规划 → 执行 → 观察 → （回到规划 / 完成），多轮、动态、不可预测。
2. **列出累积来源。** 工具调用 50–200 token；工具结果 100–10000 token；中间推理 50–200 token。
3. **列出五种上下文类型。** 任务（怎么完成）、工具（我能做什么 / 我刚做了什么）、状态（做完了什么 / 还剩什么）、记忆（之前记得什么）、协调（其他 Agent 在干什么、我等了多久、什么时候把结果发出去）。
4. **推导退化曲线。** 第 1 轮 500 token → 第 5 轮约 3k → 第 10 轮 8k → 第 15 轮 15k+，此时任务被埋，注意力丢失（context rot / lost in the middle）。
5. **推导预算算式（128k 例子）。** 系统+任务 2k 固定 + 工具 schema 3k 固定 = 5k；128k − 5k = 123k；再留 20% 内部安全余量 → 实际工作空间约 100k；每轮平均 1000 token → 溢出前约 100 轮；工具密集时每轮消耗大得多 → 实际约 20 轮。
6. **得出结论。** 退化先于溢出；窗口再大也不解决；压缩不是可选项。

### 3.5 P031 复现步骤

**第 1 步：定义 `Tool` 数据类。** [07:51]：「封装 name、description、parameters 和 categories。」[08:20] 实例化了 web_search（参数 query: string、num_results: integer，category 是 research）等一批 demo 工具。

**第 2 步：DynamicToolLoader。** [08:58]：「只关注相关的工具，全部由任务引导。」按任务关键词匹配工具的 categories。

**第 3 步：ToolResultCompressor。** [09:28]：「默认用基于规则的，但你可以升级加 LLM 摘要，比如换成 Claude Haiku。」内部有 compress_web_content、compress_db_result、generic compressor。

**第 4 步：ToolInvocationContext。** [09:50]：「why 和关键发现胜过原始数据。只外推关键发现。返回工具名、why、参数、关键发现。」

**第 5 步：错误处理。** [10:19]：「错误会来，有时很啰嗦，那些堆栈会撑爆上下文。」压缩成可操作错误（recoverable、suggestion）。

**第 6 步：ToolContextManager 组装 + demo。** [10:49]：「init 里加载 data map to loader，创建 compressor、error handler、tool invocation context，传入 history。」然后对四个任务循环演示。

**第 7 步：跑起来看输出。** 预期看到：任务「search for information about AI trends」只选 web_search，节省约 59.5%；「calculate the ROI」选 calculator + code_executor，省约 82%；「read the config file and update settings」选 file_reader + file_writer，省约 75%；「send an email」省约 82%；结果压缩 1400 → 149 token（rule-based truncation）；最终统计 average savings 89.4%。

---

## 4. 完整代码

> 说明：逐字稿是讲师口述，没有 OCR 代码。以下代码严格按逐字稿描述的函数名、类名、参数、行为重建，**能直接保存运行**。凡讲师没讲的实现细节（如具体正则、具体 prompt 文案），在注释里标「课里没讲，此处为可运行的最小实现」。

### 4.1 `p029_chatbot_memory/models.py`

```python
"""数据模型：Message / Memory / UserProfile"""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
import uuid


@dataclass
class Message:
    role: str                 # "user" | "assistant"
    content: str
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())


@dataclass
class Memory:
    category: str             # identity / financial / preference ...
    content: str
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())


@dataclass
class UserProfile:
    user_id: str
    memories: list[Memory] = field(default_factory=list)

    def add_memory(self, category: str, content: str) -> bool:
        """去重后加入。返回 True 表示真的新增了。
        讲师 [04:41]：'确保筛一遍，不要重复保存同一个东西，那会让记忆膨胀。'
        """
        normalized = content.strip().lower()
        for m in self.memories:
            if m.category == category and m.content.strip().lower() == normalized:
                return False
        self.memories.append(Memory(category=category, content=content))
        return True

    def get_memory_by_category(self, category: str) -> list[Memory]:
        """讲师 [05:09]：'functional getMemory by category，拿到所有分类好的记忆。'"""
        return [m for m in self.memories if m.category == category]

    def to_dict(self) -> dict:
        return {
            "user_id": self.user_id,
            "memories": [
                {"id": m.id, "category": m.category,
                 "content": m.content, "created_at": m.created_at}
                for m in self.memories
            ],
        }

    @classmethod
    def from_dict(cls, data: dict) -> "UserProfile":
        profile = cls(user_id=data["user_id"])
        for m in data.get("memories", []):
            profile.memories.append(
                Memory(id=m["id"], category=m["category"],
                       content=m["content"], created_at=m["created_at"])
            )
        return profile
```

### 4.2 `p029_chatbot_memory/conversation.py`

```python
"""ConversationManager：滑动窗口 + 轻量摘要"""
from models import Message


class ConversationManager:
    def __init__(self, max_turns: int = 10):
        # 讲师 [06:32]：'give max turns 10'
        self.max_turns = max_turns
        self.messages: list[Message] = []
        self.summary: str = ""

    def add(self, role: str, content: str) -> None:
        self.messages.append(Message(role=role, content=content))
        if len(self.messages) > self.max_turns:
            self.summarize_old()

    def summarize_old(self) -> None:
        """把超出窗口的旧消息压成一句轻量摘要。
        课里没讲具体摘要算法；这里用截断拼接做最小实现，
        生产环境应换成 LLM 摘要。
        """
        overflow = self.messages[:-self.max_turns]
        if not overflow:
            return
        joined = " | ".join(f"{m.role}: {m.content[:80]}" for m in overflow)
        self.summary = (self.summary + " " + joined).strip()
        self.messages = self.messages[-self.max_turns:]

    def get_context(self) -> str:
        """返回真正注入的上下文：摘要 + 窗口内消息。"""
        parts = []
        if self.summary:
            parts.append(f"[Earlier summary] {self.summary}")
        for m in self.messages:
            parts.append(f"{m.role}: {m.content}")
        return "\n".join(parts)
```

### 4.3 `p029_chatbot_memory/store.py`

```python
"""MemoryStore：JSON 持久化（生产环境应换数据库）"""
import json
import os
from models import UserProfile


class MemoryStore:
    def __init__(self, path: str = "chatbot_memory.json"):
        # 讲师 [07:02]：'path to our chatbot main with JSON'
        self.path = path
        self._data: dict[str, dict] = {}
        if os.path.exists(self.path):
            with open(self.path, "r", encoding="utf-8") as f:
                self._data = json.load(f)

    def get_profile(self, user_id: str) -> UserProfile:
        if user_id in self._data:
            return UserProfile.from_dict(self._data[user_id])
        return UserProfile(user_id=user_id)

    def save_profile(self, profile: UserProfile) -> None:
        self._data[profile.user_id] = profile.to_dict()
        with open(self.path, "w", encoding="utf-8") as f:
            json.dump(self._data, f, ensure_ascii=False, indent=2)
```

### 4.4 `p029_chatbot_memory/extractors.py`

```python
"""两种可互换的抽取策略：规则版 / LLM 版"""
import json
import re
from models import Message

try:
    import anthropic
except ImportError:
    anthropic = None


class RuleBasedExtractor:
    """讲师 [01:56]：'快、免费、无 API 调用、可单测，但只能捕获预期内的模式。'"""

    NAME_PATTERNS = [
        r"my name is ([A-Z][a-z]+)",
        r"i'm ([A-Z][a-z]+)",
        r"i am ([A-Z][a-z]+)",
    ]
    BUDGET_PATTERN = r"(?:budget|under|around)\s*\$?(\d{3,6})"

    def extract(self, message: Message) -> list[tuple[str, str]]:
        """返回 [(category, content), ...]"""
        text = message.content
        facts: list[tuple[str, str]] = []

        for pat in self.NAME_PATTERNS:
            m = re.search(pat, text, re.IGNORECASE)
            if m:
                facts.append(("identity", f"Name is {m.group(1)}"))
                break

        if re.search(r"software developer|engineer|developer", text, re.IGNORECASE):
            facts.append(("identity", "Works as a software developer"))

        m = re.search(self.BUDGET_PATTERN, text, re.IGNORECASE)
        if m:
            facts.append(("financial", f"Budget is around ${m.group(1)}"))

        if re.search(r"macbook", text, re.IGNORECASE):
            facts.append(("preference", "Prefers MacBook but open to other options"))

        return facts


class LLMExtractor:
    """讲师 [02:19]：'用大模型决定记住什么，能捕获意料之外的事实，每次一次 API 调用。'
    讲师 [06:06]：'用 Claude Haiku，更便宜更快。'
    """

    def __init__(self, model: str = "claude-3-5-haiku-latest"):
        if anthropic is None:
            raise RuntimeError("请先 pip install anthropic")
        self.client = anthropic.Anthropic()   # 读 ANTHROPIC_API_KEY
        self.model = model

    def extract(self, message: Message) -> list[tuple[str, str]]:
        prompt = (
            "从下面这条用户消息中抽取值得长期记住的事实。"
            "只返回 JSON 数组，每项形如 {\"category\": \"...\", \"content\": \"...\"}。"
            "category 只能是 identity / financial / preference 之一。"
            "没有可记的就返回 []。\n\n"
            f"消息：{message.content}"
        )
        resp = self.client.messages.create(
            model=self.model,
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = resp.content[0].text.strip()
        try:
            items = json.loads(raw)
        except json.JSONDecodeError:
            return []
        return [(i["category"], i["content"]) for i in items]
```

### 4.5 `p029_chatbot_memory/retriever.py`

```python
"""MemoryRetriever：查询相关 + 永远包含"""
from models import UserProfile

# 讲师 [03:32]：'query relevant, plus always include strategies'
ALWAYS_INCLUDE_CATEGORIES = {"identity"}


class MemoryRetriever:
    def __init__(self, always_include: set[str] | None = None):
        self.always_include = always_include or ALWAYS_INCLUDE_CATEGORIES

    def retrieve(self, profile: UserProfile, query: str) -> list[str]:
        """挑出要注入当前轮的记忆。"""
        selected: list[str] = []
        q = query.lower()

        for mem in profile.memories:
            if mem.category in self.always_include:
                selected.append(f"[{mem.category}] {mem.content}")
                continue
            # 查询相关：内容里的词出现在 query 里
            words = [w for w in mem.content.lower().split() if len(w) > 3]
            if any(w in q for w in words):
                selected.append(f"[{mem.category}] {mem.content}")

        return selected
```

### 4.6 `p029_chatbot_memory/chatbot.py`

```python
"""Chatbot：把所有组件组装起来"""
from conversation import ConversationManager
from store import MemoryStore
from retriever import MemoryRetriever
from extractors import RuleBasedExtractor, LLMExtractor
from models import Message

try:
    import anthropic
except ImportError:
    anthropic = None


class Chatbot:
    def __init__(self, user_id: str, store_path: str = "chatbot_memory.json",
                 use_llm_extractor: bool = False, max_turns: int = 10):
        self.user_id = user_id
        self.store = MemoryStore(store_path)
        self.profile = self.store.get_profile(user_id)
        self.conversation = ConversationManager(max_turns=max_turns)
        self.extractor = LLMExtractor() if use_llm_extractor else RuleBasedExtractor()
        self.retriever = MemoryRetriever()
        self.client = anthropic.Anthropic() if anthropic else None

    def _build_system_context(self, query: str) -> str:
        """讲师 [01:47]：'proper injection，结构化 system context。'"""
        memories = self.retriever.retrieve(self.profile, query)
        mem_block = "\n".join(f"- {m}" for m in memories) if memories else "(none)"
        return (
            "You are a helpful shopping assistant with long-term memory.\n"
            f"Known facts about the user:\n{mem_block}\n"
            f"Conversation so far:\n{self.conversation.get_context()}"
        )

    def chat(self, user_message: str) -> str:
        self.conversation.add("user", user_message)

        # 抽取并持久化
        for category, content in self.extractor.extract(Message(role="user", content=user_message)):
            self.profile.add_memory(category, content)
        self.store.save_profile(self.profile)

        # 生成回复（课里没讲具体生成调用；这里用 Claude 做最小实现）
        if self.client is None:
            reply = f"(offline) 收到：{user_message}"
        else:
            resp = self.client.messages.create(
                model="claude-3-5-haiku-latest",
                max_tokens=512,
                system=self._build_system_context(user_message),
                messages=[{"role": "user", "content": user_message}],
            )
            reply = resp.content[0].text

        self.conversation.add("assistant", reply)
        return reply
```

### 4.7 `p029_chatbot_memory/main.py`

```python
"""两段会话 demo：验证跨会话记忆"""
import os
from chatbot import Chatbot

STORE = "chatbot_memory.json"
if os.path.exists(STORE):
    os.remove(STORE)   # 讲师 [07:02]：'we're going to clean up as things are going'

print("=== Session 1 ===")
bot1 = Chatbot(user_id="sarah", store_path=STORE, use_llm_extractor=False)
for msg in [
    "Hi, my name is Sarah. I'm a software developer.",
    "I'm looking for a laptop. My budget is around $1500.",
    "I like MacBooks but I'm open to other options.",
]:
    print(f"User: {msg}")
    print(f"Bot:  {bot1.chat(msg)}\n")

print(f"Memories saved: {len(bot1.profile.memories)}")
for m in bot1.profile.memories:
    print(f"  [{m.category}] {m.content}")

print("\n=== Session 2 (new session, same user) ===")
bot2 = Chatbot(user_id="sarah", store_path=STORE, use_llm_extractor=False)
print(f"Loaded memories: {len(bot2.profile.memories)}")
print(f"User: Hi again")
print(f"Bot:  {bot2.chat('Hi again, still looking for that MacBook under 1500. Any recommendation based on our last conversation?')}")
```

### 4.8 `p031_tool_context/tool_context_manager.py`

```python
"""工具上下文管理：四大策略 + demo"""
from dataclasses import dataclass, field
import json
import re

try:
    import anthropic
except ImportError:
    anthropic = None


# ---------- 数据类 ----------
@dataclass
class Tool:
    """讲师 [07:51]：'封装 name、description、parameters 和 categories。'"""
    name: str
    description: str
    parameters: dict
    categories: list[str] = field(default_factory=list)


def estimate_tokens(text: str) -> int:
    """讲师 [07:51]：'estimate 函数，给个粗略估计，仅用于 demo。'
    课里没讲具体算法；这里用 4 字符≈1 token 的常见近似。
    """
    return max(1, len(text) // 4)


# ---------- 策略 1：动态工具加载 ----------
class DynamicToolLoader:
    """讲师 [08:58]：'只关注相关的工具，全部由任务引导。'"""

    def __init__(self, tools: list[Tool]):
        self.tools = tools

    def select(self, task: str) -> list[Tool]:
        q = task.lower()
        selected = []
        for tool in self.tools:
            if any(cat.lower() in q for cat in tool.categories):
                selected.append(tool)
            elif tool.name.replace("_", " ") in q:
                selected.append(tool)
        return selected


# ---------- 策略 2：工具结果压缩 ----------
class ToolResultCompressor:
    """讲师 [09:28]：'默认基于规则，可升级加 LLM 摘要。'
    讲师 [03:39]：'先确定性规则：保留前几行 + URL，再过 LLM 抽关键发现。'
    """

    def __init__(self, use_llm: bool = False, model: str = "claude-3-5-haiku-latest"):
        self.use_llm = use_llm
        self.model = model
        self.client = anthropic.Anthropic() if (use_llm and anthropic) else None

    def compress_web_content(self, text: str) -> str:
        lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
        head = lines[:5]
        urls = re.findall(r"https?://\S+", text)[:5]
        return "\n".join(head + urls)

    def compress_db_result(self, text: str) -> str:
        try:
            rows = json.loads(text)
            if isinstance(rows, list):
                return json.dumps(rows[:5], ensure_ascii=False)
        except json.JSONDecodeError:
            pass
        return text[:500]

    def generic_compress(self, text: str) -> str:
        return text[:500]

    def compress(self, tool_name: str, result: str) -> tuple[str, str]:
        """返回 (压缩后文本, 使用的模式)。"""
        if "web" in tool_name:
            compressed = self.compress_web_content(result)
        elif "db" in tool_name or "database" in tool_name:
            compressed = self.compress_db_result(result)
        else:
            compressed = self.generic_compress(result)

        mode = "rule-based truncation"
        if self.use_llm and self.client:
            resp = self.client.messages.create(
                model=self.model,
                max_tokens=256,
                messages=[{"role": "user", "content":
                    f"从下面工具结果中只抽取关键发现，一两句话：\n{compressed}"}],
            )
            compressed = resp.content[0].text.strip()
            mode = "llm-summarized"
        return compressed, mode


# ---------- 策略 3：结构化调用上下文 ----------
class ToolInvocationContext:
    """讲师 [09:50]：'why 和关键发现胜过原始数据。'"""

    def format(self, tool_name: str, why: str, arguments: dict, key_findings: str) -> str:
        return (
            f"Tool: {tool_name}\n"
            f"Why: {why}\n"
            f"Arguments: {json.dumps(arguments, ensure_ascii=False)}\n"
            f"Key findings: {key_findings}"
        )


# ---------- 策略 4：错误上下文处理 ----------
class ErrorContextHandler:
    """讲师 [10:19]：'错误很啰嗦，堆栈会撑爆上下文，压缩成可操作错误。'"""

    def compact(self, error: str, tool_name: str) -> str:
        recoverable = "timeout" in error.lower() or "rate" in error.lower()
        if "permission" in error.lower() or "access denied" in error.lower():
            suggestion = "skip this file request"
        elif recoverable:
            suggestion = "try with longer timeout or simpler query"
        else:
            suggestion = "inspect arguments and retry"
        return (
            f"Tool: {tool_name}\n"
            f"Error: {error.splitlines()[0]}\n"
            f"Recoverable: {recoverable}\n"
            f"Suggestion: {suggestion}"
        )


# ---------- 组装 ----------
class ToolContextManager:
    """讲师 [10:49]：'init 里加载 data map to loader，创建 compressor、error handler、invocation context，传入 history。'"""

    def __init__(self, tools: list[Tool], use_llm_compress: bool = False):
        self.tools = tools
        self.loader = DynamicToolLoader(tools)
        self.compressor = ToolResultCompressor(use_llm=use_llm_compress)
        self.invocation = ToolInvocationContext()
        self.error_handler = ErrorContextHandler()
        self.history: list[str] = []
        self.stats = {"invocations": 0, "original_tokens": 0, "optimized_tokens": 0}

    def run(self, task: str, why: str, arguments: dict,
            raw_result: str, error: str | None = None) -> str:
        selected = self.loader.select(task)
        original = sum(estimate_tokens(json.dumps({
            "name": t.name, "description": t.description, "parameters": t.parameters
        })) for t in self.tools)
        optimized = sum(estimate_tokens(json.dumps({
            "name": t.name, "description": t.description, "parameters": t.parameters
        })) for t in selected)

        if error:
            ctx = self.error_handler.compact(error, selected[0].name if selected else "unknown")
        else:
            compressed, mode = self.compressor.compress(
                selected[0].name if selected else "generic", raw_result)
            ctx = self.invocation.format(
                selected[0].name if selected else "generic", why, arguments, compressed)

        self.stats["invocations"] += 1
        self.stats["original_tokens"] += original + estimate_tokens(raw_result)
        self.stats["optimized_tokens"] += optimized + estimate_tokens(ctx)
        self.history.append(ctx)
        return ctx


# ---------- demo ----------
if __name__ == "__main__":
    tools = [
        Tool("web_search", "Search the web for information",
             {"query": "string", "num_results": "integer"}, ["research", "search"]),
        Tool("read_web_page", "Read a web page",
             {"url": "string"}, ["research", "read"]),
        Tool("database_query", "Query the database",
             {"sql": "string"}, ["data", "query"]),
        Tool("calculator", "Do math",
             {"expression": "string"}, ["calculate", "math"]),
        Tool("code_executor", "Execute code",
             {"code": "string"}, ["calculate", "execute"]),
        Tool("file_reader", "Read a file",
             {"path": "string"}, ["read", "file"]),
        Tool("file_writer", "Write a file",
             {"path": "string", "content": "string"}, ["update", "file"]),
        Tool("send_email", "Send an email",
             {"to": "string", "body": "string"}, ["email", "send"]),
    ]

    mgr = ToolContextManager(tools, use_llm_compress=False)

    tasks = [
        ("search for information about AI trends", "need to find information about AI trends 2025",
         {"query": "AI trends"}, "x" * 5600),
        ("calculate the ROI of this project", "need ROI numbers",
         {"expression": "roi"}, "y" * 1200),
        ("read the config file and update settings", "need to read and update config",
         {"path": "config.json"}, "z" * 800),
        ("send an email", "need to notify the team",
         {"to": "team@example.com"}, "w" * 400),
    ]

    for task, why, args, raw in tasks:
        ctx = mgr.run(task, why, args, raw)
        print(f"--- Task: {task} ---")
        print(ctx)
        print()

    # 错误处理演示
    print("--- Error handling demo ---")
    print(mgr.run("database query", "need user rows", {"sql": "select * from users"},
                  "", error="PermissionError: access denied"))

    s = mgr.stats
    savings = 100 * (1 - s["optimized_tokens"] / max(1, s["original_tokens"]))
    print(f"\nInvocations: {s['invocations']}")
    print(f"Average savings: {savings:.1f}%")
```

---

## 5. 逐行解释

### 5.1 P029 记忆系统

**`UserProfile.add_memory` 的去重逻辑。** 讲师在 [04:41] 特意强调「不要重复保存同一个东西，那会让记忆膨胀」。所以先 `strip().lower()` 归一化，再逐条比对 category + content。在 JS/Node 里对应 `array.some(m => m.category === c && m.content.trim().toLowerCase() === n)`，思路完全一样。

**`ConversationManager.summarize_old`。** 讲师 [05:09] 说它做「滑动窗口 + 轻量摘要」。窗口 `max_turns=10` 来自 [06:32]。超出窗口的旧消息被拼成一句摘要存进 `self.summary`，窗口只保留最近 10 条。`get_context()` 返回「摘要 + 窗口内消息」，这就是真正注入模型的上下文。课里没讲摘要用什么算法，这里用截断拼接做最小实现——生产环境应换成 LLM 摘要，否则摘要本身也会膨胀。

**`MemoryStore` 为什么用 JSON。** 讲师 [00:56] 和 [05:38] 两次强调：「生产级应用要存数据库」。JSON 只是 demo 的持久化载体，路径 `chatbot_memory.json` 来自 [07:02]。`save_profile` 每次全量写盘，demo 够用；生产要换成带事务的数据库——在 Node 里对应 Prisma / Drizzle 之类，注意并发写要加锁或用数据库自身的行锁。

**两个抽取器为什么可互换。** 讲师 [01:56]：规则版「快、免费、无 API 调用、可单测」，但「只能捕获预期内的模式」。所以 `RuleBasedExtractor` 用正则硬编码了名字、职业、预算、MacBook 偏好四类模式。`LLMExtractor` 在 [02:19] 被描述为「能捕获意料之外的事实，但每次一次 API 调用、要花钱」，[06:06] 指定用 Claude Haiku「更便宜更快」。两者签名一致（`extract(message) -> list[(category, content)]`），所以 `Chatbot` 里一个布尔开关就能切换。

**`MemoryRetriever` 的「查询相关 + 永远包含」。** [03:32] 和 [06:06] 都强调这是「非常非常重要的一块」。实现上：`identity` 类永远注入（否则机器人连用户叫什么都忘了），其余类别按「记忆内容里的词是否出现在当前 query 里」判断相关性。这是最朴素的词面匹配，课里没讲是否用向量检索——如果要升级，把 `words` 匹配换成 embedding 相似度即可。

**`Chatbot._build_system_context` 的结构化注入。** [01:47]：「proper injection，结构化 system context。」所以 system prompt 分成三段：角色、已知事实（来自 retriever）、对话历史（来自 conversation manager）。这样模型每次看到的都是「整理过的」上下文，而不是原始消息堆。

### 5.2 P030 的推导为什么这样成立

**为什么 Agent 上下文会累积。** [02:41] 给了三个来源的量级：工具调用 50–200、工具结果 100–10000、中间推理 50–200。注意工具结果的上限是调用上限的 50 倍——这就是为什么 [05:35] 说「任务被埋在几千 token 的工具输出下面」。在 Node 里写 Agent 循环时，每一轮 `messages.push(...)` 都在累加，和这里说的是同一件事。

**退化曲线的数字。** 第 1 轮 500 → 第 5 轮 3k → 第 10 轮 8k → 第 15 轮 15k+。这不是线性增长，因为工具结果在放大。到 15k 时「注意力丢失」，即 context rot / lost in the middle——模型对中间位置的信息召回最差。

**128k 预算算式逐步拆。** 系统+任务 2k 固定，工具 schema 3k 固定，合计 5k；128k − 5k = 123k 可用；但 [08:44] 说「留 20% 内部安全余量」，所以实际工作空间约 100k；每轮平均 1000 token → 约 100 轮；工具密集时每轮远超 1000 → 实际约 20 轮。这个推导的意义是：**名义窗口 128k，有效轮数可能只有 20**。

**为什么「退化先于溢出」。** [06:47] 的原话：一百万窗口的模型在 15k 任务上不会溢出，但完全可以丢线索。所以判断标准不是「还剩多少 token」，而是「关键信息还在不在注意力范围内」。这就是 [07:11] 说的「上下文管理是质量问题，不只是容量问题」。

### 5.3 P031 四大策略

**为什么先管工具。** [00:00]：工具占 60–80% 预算。所以四个策略里有三个直接针对工具。

**动态工具加载省 73% 的原理。** [00:20]：10 个工具 × 200 token = 2000 token 的 schema 开销。如果任务只需要 1–2 个工具，schema 开销就降到 200–400。`DynamicToolLoader.select` 按任务的词匹配工具的 `categories`，这就是 [02:30] 说的「注册每个工具的类别，只按任务分析加载」。

**结果压缩的两级设计。** [03:39]：先确定性规则（保留前几行 + URL），再过 LLM 抽关键发现。第一级免费、可预测；第二级保语义。两者结合 15000 → 约 800，省约 95%。代码里 `compress_web_content` 是规则级，`use_llm=True` 时再走一遍 Claude Haiku。

**结构化调用为什么省 70%。** [09:50]：「why 和关键发现胜过原始数据。」原始调用上下文是「工具名 + 参数 + 完整结果」；结构化后是「工具名 + why + 参数 + 关键发现」。结果部分从原始数据变成一两句发现，500 → 150。

**错误处理为什么省 80%。** [10:19]：错误 + 堆栈约 300 token，而且很啰嗦。`ErrorContextHandler.compact` 只保留首行错误、是否可恢复、建议动作，500 → 100。注意 `Recoverable` 和 `Suggestion` 这两个字段名是逐字稿 [14:00] 里讲师念出来的（「recoverable, true, suggested to try with longer timeout or simpler query」），可以直接用。

**总账。** [06:32] 的汇总表：动态加载 3000→800（73%）、结果压缩 15000→800（95%）、结构化调用 500→150（70%）、错误处理 500→100（80%）。全部实现，典型总节省 70–90%。demo 跑出来 `Average savings: 89.4%`，和 [14:18] 讲师念的数字一致。

---

## 6. 复现检查清单

**P029**

- [ ] `python3 -m venv .venv && source .venv/bin/activate` 成功
- [ ] `pip install anthropic` 成功，`ANTHROPIC_API_KEY` 已设置
- [ ] 六个文件（models / conversation / store / extractors / retriever / chatbot / main）都在 `p029_chatbot_memory/` 下
- [ ] `python main.py` 跑完 Session 1，打印 `Memories saved: 3`（对应 [08:27]「three memories saved」）
- [ ] `chatbot_memory.json` 已生成，里面有 identity / financial / preference 三类
- [ ] Session 2 打印 `Loaded memories: 3`，且回复里提到 Sarah、1500、MacBook
- [ ] 把 `use_llm_extractor=True` 再跑一次，确认 LLM 抽取器也能工作（需要 API key）
- [ ] 重复发同一条消息，确认 `add_memory` 返回 False、记忆数不增加

**P030（概念核对）**

- [ ] 能说出五种上下文类型：任务 / 工具 / 状态 / 记忆 / 协调
- [ ] 能复述退化曲线：500 → 3k → 8k → 15k+
- [ ] 能独立算出 128k 例子的「约 20 轮」：128k − 5k = 123k，×80% ≈ 100k，工具密集时每轮远超 1000
- [ ] 能解释「退化先于溢出」和「质量 vs 容量」

**P031**

- [ ] `python tool_context_manager.py` 跑通
- [ ] 任务「search for information about AI trends」只选中 `web_search`
- [ ] 任务「calculate the ROI」选中 `calculator` + `code_executor`
- [ ] 任务「read the config file and update settings」选中 `file_reader` + `file_writer`
- [ ] 任务「send an email」只选中 `send_email`
- [ ] 结果压缩输出里能看到 `rule-based truncation`
- [ ] 错误处理输出里有 `Recoverable: True` 和 `Suggestion: try with longer timeout or simpler query`
- [ ] 最终打印 `Average savings` 在 70–90% 区间（demo 约 89.4%）
- [ ] 把 `use_llm_compress=True` 再跑一次，确认模式变成 `llm-summarized`

---

## 7. 课里没讲但你会撞上的

1. **`anthropic` SDK 的具体调用形态。** 逐字稿只说了「用 Claude Haiku」，没念 `messages.create` 的参数。上面代码用的是当前 SDK 的常见写法，如果你的 SDK 版本不同，`resp.content[0].text` 的取值路径可能不同——以实际报错为准。

2. **模型 ID。** 讲师说「Claude Haiku」，但没给完整字符串。`claude-3-5-haiku-latest` 是占位，请换成你账号可用的 ID。

3. **JSON 并发写。** `MemoryStore.save_profile` 每次全量覆盖写盘。单进程 demo 没问题，多用户并发会丢数据。生产要换数据库；在 Node 里对应用数据库事务或文件锁（如 `proper-lockfile`）。

4. **摘要算法。** `summarize_old` 用的是截断拼接，不是真正的摘要。长会话下 `self.summary` 自己也会膨胀——这正是 P030 讲的「上下文累积」在记忆系统里的翻版。生产要换成 LLM 摘要并限制摘要长度。

5. **检索的相关性判断。** `MemoryRetriever` 用的是词面匹配（`len(w) > 3` 且出现在 query 里）。同义词、跨语言、拼写差异都会漏。升级路径是 embedding 相似度，但课里没讲。

6. **`estimate_tokens` 的精度。** 用的是「4 字符 ≈ 1 token」的粗略近似，只用于 demo 的相对比较。真实计费要以 API 返回的 usage 为准。

7. **P031 的 demo 结果是模拟的。** 讲师 [12:56] 明说「这只是观察用的 demo，生产里你会用大模型」。所以 `raw_result` 里的 `"x" * 5600` 是假数据，节省百分比只反映策略的相对效果，不是真实工具的输出。

8. **`Tool.categories` 的匹配是关键词级的。** `DynamicToolLoader.select` 靠任务文本里出现类别词来选工具。任务措辞一变就可能选错。生产里通常让 LLM 先做一次「任务 → 需要哪些工具」的分类，课里没讲这一步。

9. **错误处理的 `Recoverable` 判断。** 代码里靠 `"timeout"` / `"rate"` 子串判断可恢复，很粗糙。真实系统要按错误类型（HTTP 状态码、异常类）分类。

10. **P030 的「协调上下文」没有代码。** 讲师 [04:14] 讲了多 Agent 协调（等其他 Agent、什么时候发结果），但三节课里没有多 Agent 的实现。这部分是概念铺垫，后续课程才展开（讲师 [10:31] 预告了 tool context management、result chaining、multi-term memory、context isolation）。