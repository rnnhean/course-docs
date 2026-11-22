# Agentic AI System Design P009：把 MCP 接进 Claude Code 克隆体，并拆开 Skills 的「渐进式披露」

## 1. 这一节做什么

这一节是整个课程里「最硬」的一段，因为它同时推进两条主线，而且两条线最后要在同一个 capstone 项目里会合。

**主线 A：把 MCP 真正落地到 edu-courses-claude 项目里。** 前面几节课已经把 MCP 的原理、GitHub MCP server 的 demo 跑过了，这一节要做的是「接进工程」：在 capstone 项目里新开一个 `mcp/` 层，用一份 JSON 描述「我要用哪些 MCP server」，加载时把 JSON 里的环境变量占位符替换成真实值，然后用 `MultiServerMCPClient` 为每个 server 建一个 client，拿到工具列表，塞进 agent factory。因为 MCP 的工具调用是异步的，整条链路（agent factory、短期记忆、`main.py`）都要改成 `async`。

**主线 B：把 Skills 这个概念拆开。** 讲师的原话是「Skills 听起来是个花哨的词，但它其实就是把英文文本放进文件夹里」。真正有价值的部分不是定义，而是**渐进式披露（progressive disclosure）**：`SKILL.md` 顶部的 YAML front matter 里只有 `name` 和 `description` 两个字段，这两个字段永远加载（约 100 token）；只有当模型判断「我需要这个 skill」时，才把正文指令（约 5k token）读进来；资源、脚本、参考资料再按需加载。这一节末尾开始写 `skills/registry.py`，做的就是「扫描目录 → 找到 `SKILL.md` → 解析 front matter → 把 name+description 作为工具描述交给 agent」。

中间还插了两个演示，都是「可复现的产物」而不是纯讲解：

1. 用 **FastMCP** 把已经写好的 terminal 工具包成一个自定义 MCP server，再用 `MultiServerMCPClient` 以 STDIO 子进程方式把它拉起来调用。
2. 用 **Playwright MCP** 做浏览器自动化，并反复强调「不设调用上限就会烧 token」。

这一节结束时的产出物清单：

| 产出物 | 位置 | 作用 |
|---|---|---|
| `mcp_servers.json` | 项目根目录（**不是** `mcp/` 里） | 声明要用哪些 MCP server |
| `mcp/client.py` | `mcp/` | 加载配置、替换环境变量、建 client、取工具 |
| `agent/factory.py` | `agent/` | 接收工具列表建 agent，不关心工具来源 |
| `memory/short_term.py` | `memory/` | 改成 async 的文件版短期记忆 |
| `main.py` | 项目根 | 组装工具、跑 async 主循环 |
| `terminal_command_runner_mcp.py` | 独立的 `mcp-demo/` 项目 | 自定义 MCP server |
| `mcp-demo/demo_client.py` | 同上 | 以 STDIO 方式调自定义 server |
| `skills/registry.py` | `skills/` | 扫描 + 解析 `SKILL.md`，实现渐进式披露 |
| `skills/<name>/SKILL.md` | 任意被 agent 操作的项目 | skill 的标准格式 |

---

## 2. 讲师原话

> "为什么需要协议？因为每个人都在用工具、都在暴露工具，所以需要标准化——一套规则告诉你工具怎么暴露、怎么使用。它是一个通用协议，就像 HTTP 也是协议一样。"
> —— p009 [03:37]

> "如果你要暴露工具，你会把它暴露成什么？暴露成 server。每个 server 不会只暴露一个工具，它可以是一组工具，比如 GitHub 有一个工具集，文件系统有一个工具集。"
> —— p009 [05:06]

> "应用本身叫 host，host 里面要创建 client，而且不是只创建一个——取决于你用多少个 server。每个 client 和每个 server 之间是一对一的映射。"
> —— p009 [06:04]

> "这些 server 不一定非要跑在 host 本机上。如果跑在同一台机器、本地，我们就用 STDIO；如果跑在别处，就用 streamable HTTP。"
> —— p009 [06:30]

> "要在应用里新增一个 server，我需要改什么？只要在列表里加一条配置，说明我要用这个。命令通常长这样：npx 加参数，或者 python 加参数，或者 docker 加参数。"
> —— p009 [07:27]

![p009 04:50 讲师画出 MCP host、client、server 的一对一映射关系](images/p009_0290s.jpg)

> "这里有一个坑：GitHub token 必须从环境变量加载。我能把 JSON 原样传进去吗？不能。所以加载 JSON 的时候，我必须确保把这些变量替换成环境变量里的值。这就是唯一一个棘手的点，本质上只是一次简单的正则匹配。"
> —— p009 [14:50]

![p009 14:30 MCP 客户端代码：读取配置、替换环境变量、创建 client 并取工具](images/p009_0870s.jpg)

> "用 MCP 时只需要做一个小改动：我们必须 await，必须用异步调用。所以我把函数改成 async，其余一切不变。"
> —— p009 [18:28]

> "能不能取到文件？能。推文件到 GitHub 也能，创建 PR 也能，取决于你 GitHub token 的权限。"
> —— p009 [23:09]

> "我已经把这些工具写好了，我不想让别人再重复这份功夫，我就把它暴露成 MCP server，别人就能用。就这么简单。"
> —— p009 [25:03]

![p009 24:10 讲师解释为什么要把自己写好的工具暴露成自定义 MCP server](images/p009_1450s.jpg)

> "什么时候用 HTTP、什么时候用 STDIO？如果工具就跑在你本地、资源够，用 STDIO；如果它跑在别处、你只想用，就给它 URL 和 transport，用 HTTP。其余一切不变。"
> —— p009 [26:29]

> "第一次用的时候，如果你不给模型调用和工具调用设上限，它会发起太多调用，最后陷进循环里。"
> —— p009 [37:48]

![p009 33:50 自定义 MCP server 启动失败，讲师在排查子进程的脚本路径](images/p009_2030s.jpg)

> "它一遍又一遍地做同一件事。如果你不设限制，会烧掉非常多的 token。所以请自己承担风险。"
> —— p009 [41:08]

> "Skills 听起来是个花哨的词，但它其实就是把英文文本放进文件夹里，配上指令、参考资料、示例，甚至可以有脚本——比如需要运行的代码。"
> —— p009 [50:05]

> "一开始只发元数据，也就是 name 和 description。等到需要的时候，如果模型说我要这个 skill，才把整个 MD 发过去。这叫渐进式披露（progressive disclosure），它按需分阶段加载信息，而不是一上来就把上下文吃光。"
> —— p009 [56:37]

![p009 53:10 Skills 仓库里的 SKILL.md 结构：front matter 加指令正文加脚本资源](images/p009_3190s.jpg)

> "第一层是元数据，永远加载；第二层是指令，被触发时加载；第三层是资源和代码，按需加载。"
> —— p009 [59:55]

> "每个 skill 的元数据，name 加 description，大概 100 个 token，永远都会发；如果这个 skill 被选中，指令大概 5k token。"
> —— p009 [60:24]

![p009 62:50 讲师对比 create_agent 与 create_deep_agent，说明后者可以直接挂 skills](images/p009_3770s.jpg)

> "skill 就以这种格式放在某个地方，代码要做的事情就是真的把它们加载进来，取出 name 和 description，发给 agent。"
> —— p009 [68:54]

> "模型可读的语言，和人类可读的语言是一样的。skill 的好处是，你不需要技术背景——市场、产品经理，任何领域的人都能写 skill、用 skill。"
> —— p009 [72:39]

![p009 72:31 skills 层与 registry.py：扫描目录、解析 SKILL.md、注册技能](images/p009_4351s.jpg)

---

## 3. 从零复现

### 3.0 前置条件

| 依赖 | 为什么需要 | 课里是否讲过 |
|---|---|---|
| Python 3.11+ | capstone 项目语言 | 课里没讲具体版本，用你 `poetry env info` 能跑通的版本即可 |
| Poetry | 依赖与虚拟环境管理，讲师明确说「我不手动建虚拟环境，Poetry 会处理」 | 讲过 |
| Node.js + npx | GitHub / Playwright 这类 MCP server 是用 `npx` 拉起来的 | 讲过（「如果你没有 NodeJS，会直接报错」） |
| GitHub Personal Access Token | GitHub MCP server 鉴权 | 讲过 |
| OpenAI 兼容的 API Key | LLM 层，课里没讲 llm 层实现细节 | 课里没讲 |

### 3.1 装依赖

进入 capstone 项目根目录，也就是 `edu-courses-claude` 这一层：

```bash
cd edu-courses-claude

# 讲师明确要求的这一条
poetry add langchain-mcp-adapters

# 课里没讲，但写自定义 MCP server 需要（FastMCP 在这个包里）
poetry add mcp

# 课里没讲：如果你想用 yaml 解析 front matter，而不是手写正则
poetry add pyyaml

# 课里没讲：LLM 层的最小实现需要
poetry add langchain langchain-openai
```

讲师在课上只念了 `poetry add langchain-mcp-adapters` 这一条，并解释了它的定位：

> "LangChain MCP adapters 是一个轻量包装层，它让 MCP 工具能兼容 LangChain 和 LangGraph。"
> —— p009 [08:47]

同一段里他还补了一句关键的「不是唯一解」：你完全可以直接调 MCP 的 API，也可以换别的框架，但 `langchain-mcp-adapters` 是目前行业里的标准做法。

### 3.2 建目录

```bash
cd edu-courses-claude

mkdir -p mcp skills agent llm memory tools observability

touch mcp/__init__.py
touch skills/__init__.py
touch agent/__init__.py
touch llm/__init__.py
touch memory/__init__.py
touch tools/__init__.py
touch observability/__init__.py
```

讲师原话是「在 `edu-courses-claude` 里再建一个 `mcp` 文件夹，为了让它成为一个 package，我建一个空的 `__init__.py`，这部分是标准操作」。

最终的目录结构：

```
edu-courses-claude/
├── pyproject.toml
├── poetry.lock
├── mcp_servers.json          # 注意：在项目根，不在 mcp/ 里
├── main.py
├── agent/
│   ├── __init__.py
│   └── factory.py
├── llm/
│   ├── __init__.py
│   └── provider.py
├── memory/
│   ├── __init__.py
│   └── short_term.py
├── tools/
│   ├── __init__.py
│   ├── file_system.py
│   └── terminal.py
├── mcp/
│   ├── __init__.py
│   └── client.py
├── skills/
│   ├── __init__.py
│   └── registry.py
└── observability/
    ├── __init__.py
    └── logging.py
```

### 3.3 写 `mcp_servers.json`——这里有一个必须踩一次的坑

讲师的第一版把 JSON 放在了 `mcp/` 目录里，运行时报了「找不到配置文件」，他原话是：

> "The JSON file should be at the edu-courses-claude level, not at the mcp level. This is a configuration, so at the config level is where I'm adding it. That is why it did not work."
> —— p009 [21:45]

所以：**`mcp_servers.json` 放在 `edu-courses-claude/` 根目录，和 `pyproject.toml` 同级。** 这一步不是风格问题，放错位置直接跑不起来。

配置文件内容见第 4 节 4.1。GitHub server 有两种启动方式（讲师提到「你会看到两个选项，一个用 npx，一个用 docker」），二选一即可；同一份 JSON 里再加一个 filesystem server，用来验证「多 server 多 client」这条映射关系。

写完之后先设置环境变量：

```bash
export GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxx"
```

Windows PowerShell：

```powershell
$env:GITHUB_TOKEN = "ghp_xxxxxxxxxxxxxxxxxxxx"
```

### 3.4 写 `mcp/client.py`

完整代码见 4.3。它只做三件事：

1. 读 `mcp_servers.json`（用绝对路径定位，避免工作目录不同导致找不到）；
2. 递归遍历配置，把 `${GITHUB_TOKEN}` 这类占位符换成 `os.environ` 里的真实值，**变量不存在就直接抛错**——讲师原话是「如果那个变量不在环境里，这段代码就跑不起来」，这是刻意设计成 fail-fast 的；
3. 用替换后的配置构造 `MultiServerMCPClient`，`await client.get_tools()` 返回工具列表。

### 3.5 改 `agent/factory.py`

唯一的改动点是「工具列表从外部传进来」。讲师的原话是：

> "在 agent factory 里，如果我再加更多 MCP server，这段代码也不会变。因为 JSON 里有什么，它就被加载什么、client 就被创建，factory 这层代码之后不会被碰。"
> —— p009 [17:59]

所以 factory 不 import 任何 MCP 相关的东西，它只接收 `tools` 参数。这样新增 server 只需要改 JSON。

### 3.6 把短期记忆改成 async

讲师明确说：「短期记忆那边，我也要把所有东西改成 async。」原因是 MCP 的工具调用是异步的，如果记忆层还是同步阻塞调用，会在事件循环里卡住。

在 JS/Node 里对应什么：这就是你在 Node 里把 `fs.readFileSync` 换成 `await fs.promises.readFile` 的那件事，心智模型完全一样。

### 3.7 改 `main.py`

讲师原话：「在 `main.py` 里我只需要把这个函数改成 async，这是我在做的唯一改动。」

改完后的结构是：`async def main()` → `tools = [*本地工具, *await get_mcp_tools()]` → 建 agent → 进入输入循环。

### 3.8 跑起来

```bash
cd edu-courses-claude
poetry run python main.py
```

预期能看到的现象（逐字稿里讲师逐条确认过）：

- 启动时创建 `.memory` 目录（原话：「dot memory is created for the short term memory」）；
- GitHub MCP server 的子进程被拉起来（原话：「can you see github mcp server is running」）；
- 输入 `list all the files in my GitHub repository`（讲师用的就是这条 query），agent 会调 MCP 工具列出仓库文件。

如果报「找不到配置文件」，回到 3.3 检查 JSON 是不是放在了 `mcp/` 里。

### 3.9 自定义 MCP server（单独的 demo 项目）

讲师这一段是**关掉 capstone 项目、另开一个 `mcp-demo` 项目**做的。原因是 capstone 里已经有一个名为 `mcp` 的本地包，会遮蔽 pip 安装的 `mcp` 包（详见第 7 节）。

```bash
mkdir mcp-demo && cd mcp-demo
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install mcp langchain-mcp-adapters
```

然后写两个文件：`terminal_command_runner_mcp.py`（server，见 4.10）和 `demo_client.py`（client，见 4.11）。

```bash
python demo_client.py
```

讲师在这一步连续踩了两次坑，都值得记录：

- 第一次：`Connection closed`；
- 第二次：`no such file or directory`，原因是子进程的工作目录和脚本相对路径对不上；
- 最终修法：换成正确的脚本路径，他最后说「file name was wrong, but it worked anyway」。

4.11 的代码用 `Path(__file__).with_name(...)` 生成绝对路径，从根上避免这个问题。

### 3.10 挂 Playwright MCP

在 `mcp_servers.json` 里再追加一个 server（见 4.2 的 `playwright` 段），然后**务必加上调用上限**再跑第一个 query：

```bash
poetry run python main.py
# 你 > go to google.com and search for "agentic ai system design"
```

讲师在这一段的警告是本节最值得抄进笔记的一句：

> "如果你不设限，它会打开浏览器、搜索、关闭、再搜索，一遍又一遍。 token 会烧得非常快。"
> —— p009 [41:08]

### 3.11 建一个 skill 并注册

在**任意一个你想让 agent 操作的项目目录**下建 `skills/`（不是 capstone 项目里，这点讲师特意强调过：skill 跟着「被操作的项目」走）：

```bash
mkdir -p skills/code-review
```

写 `skills/code-review/SKILL.md`（内容见 4.13），然后在 capstone 的 `main.py` 里把 `list_skills` 和 `read_skill` 两个工具挂进工具列表，再把环境变量 `SKILLS_DIR` 指向目标项目的 `skills/` 目录：

```bash
export SKILLS_DIR="/path/to/your/project/skills"
poetry run python main.py
```

---

## 4. 完整代码

> 说明：逐字稿里讲师是边写边讲，屏幕上很多代码没有逐字念出来，本节 OCR 结果为空。以下文件按讲师口述的结构、命名和他在课上展示的关键片段重建；凡是**逐字稿没有明确给出**的实现细节（比如 llm 层怎么选模型、pyproject 里的具体版本号），都在该文件的注释里标注了「课里没讲」，请以你本地的实际输出为准。

### 4.1 `mcp_servers.json`

```json
{
  "mcpServers": {
    "github": {
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
      }
    },
    "filesystem": {
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."]
    }
  }
}
```

如果你想用 Docker 方式跑 GitHub server（讲师说官方给了 npx 和 docker 两个选项），把 `github` 这一段换成：

```json
"github": {
  "transport": "stdio",
  "command": "docker",
  "args": [
    "run", "-i", "--rm",
    "-e", "GITHUB_PERSONAL_ACCESS_TOKEN",
    "ghcr.io/github/github-mcp-server"
  ],
  "env": {
    "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
  }
}
```

> 注意：`@modelcontextprotocol/server-github` 和 `ghcr.io/github/github-mcp-server` 这两个包名课里没有逐字念出来（讲师只说了「npx 加参数」「docker 加参数」）。如果你照抄报 `404`，去 GitHub MCP server 的官方 README 复制当下的命令，配置结构不用改。

### 4.2 追加 Playwright server

在同一个 `mcpServers` 对象里追加：

```json
"playwright": {
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@playwright/mcp@latest"]
}
```

> 同上，`@playwright/mcp@latest` 这个包名是 Playwright MCP 官方 README 里的写法，课里只展示了一个 npx 风格的配置块，没有念出包名。

### 4.3 `mcp/client.py`

```python
"""MCP 层：加载服务器配置、替换环境变量、创建多 server 客户端。"""

import json
import os
import re
from pathlib import Path
from typing import Any

from langchain_mcp_adapters.client import MultiServerMCPClient

# 配置文件在项目根目录，不在 mcp/ 包里。
PROJECT_ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = PROJECT_ROOT / "mcp_servers.json"

# 支持 ${VAR} 形式的占位符。
_ENV_PATTERN = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9_]*)\}")


def _resolve_env(value: Any) -> Any:
    """递归替换配置里的 ${VAR}。

    变量不存在时直接抛错，不要静默变成空字符串——
    否则 MCP server 会带着一个空 token 启动，报错信息会离现场很远。
    """
    if isinstance(value, str):
        def _replace(match: re.Match) -> str:
            name = match.group(1)
            if name not in os.environ:
                raise RuntimeError(
                    f"环境变量 {name} 未设置，MCP server 无法启动。"
                    f"请先 export {name}=..."
                )
            return os.environ[name]

        return _ENV_PATTERN.sub(_replace, value)

    if isinstance(value, list):
        return [_resolve_env(item) for item in value]

    if isinstance(value, dict):
        return {key: _resolve_env(item) for key, item in value.items()}

    return value


def load_mcp_config(path: Path = CONFIG_PATH) -> dict:
    """读取 JSON 配置并完成环境变量替换，返回 server 名字到连接参数的映射。"""
    if not path.exists():
        raise FileNotFoundError(
            f"找不到 MCP 配置文件：{path}。"
            f"它必须放在 edu-courses-claude 项目根目录，不能放在 mcp/ 里面。"
        )

    raw = json.loads(path.read_text(encoding="utf-8"))
    servers = raw.get("mcpServers", raw)
    return _resolve_env(servers)


async def get_mcp_tools() -> list:
    """为每个 server 创建一个 client，取回全部工具。

    新增 server 只需要改 mcp_servers.json，这个函数和 agent factory 都不用动。
    """
    servers = load_mcp_config()
    if not servers:
        return []

    client = MultiServerMCPClient(servers)
    return await client.get_tools()
```

### 4.4 `agent/factory.py`

```python
"""Agent 工厂：只负责用给定的工具列表建 agent，不关心工具从哪来。"""

from langchain.agents import create_agent

from llm.provider import get_chat_model

SYSTEM_PROMPT = """你是 edu-courses-claude，一个在用户项目目录里工作的编码 Agent。

工作方式：
1. 先理解用户意图，再决定是否需要调用工具。
2. 需要读文件、写文件、跑命令时，直接调用对应工具，不要猜测文件内容。
3. 工具返回错误时，先读错误信息再决定下一步，不要重复同样的调用。
4. 回答用中文，代码块标注语言。
"""


def build_agent(tools: list, system_prompt: str = SYSTEM_PROMPT):
    """工具列表由调用方传入，本地工具和 MCP 工具在这里没有区别。"""
    model = get_chat_model()
    return create_agent(
        model=model,
        tools=tools,
        system_prompt=system_prompt,
    )
```

### 4.5 `llm/provider.py`

```python
"""LLM 层的最小实现。课里没讲这一层的具体代码，只说了『按配置创建模型』。"""

import os

from langchain_openai import ChatOpenAI


def get_chat_model() -> ChatOpenAI:
    """按环境变量创建模型。

    课里没讲模型名怎么配，这里留一个 MODEL_NAME 环境变量。
    讲师在 Playwright 演示里提到他用了较新的模型（他说的是 GPT 5.5 和 GPT 4.0 的对比），
    并强调新模型在浏览器自动化这种多步任务上表现明显更好。
    """
    return ChatOpenAI(
        model=os.getenv("MODEL_NAME", "gpt-4.1"),
        api_key=os.getenv("OPENAI_API_KEY"),
        temperature=0,
    )
```

### 4.6 `memory/short_term.py`

```python
"""短期记忆：落盘到 .memory/short_term.json，全部接口改成 async。"""

import json
from pathlib import Path

DEFAULT_PATH = Path(".memory") / "short_term.json"


class ShortTermMemory:
    def __init__(self, path: Path = DEFAULT_PATH) -> None:
        self.path = path

    async def load(self) -> list[dict]:
        if not self.path.exists():
            return []
        return json.loads(self.path.read_text(encoding="utf-8"))

    async def save(self, messages: list[dict]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(
            json.dumps(messages, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
```

### 4.7 `tools/file_system.py`

```python
"""文件系统工具。课里说这部分前面已经写好了，这里给能支撑本节复现的最小实现。"""

from pathlib import Path

from langchain_core.tools import tool


@tool
def read_file(path: str) -> str:
    """读取项目内某个文件的完整内容。"""
    return Path(path).read_text(encoding="utf-8")


@tool
def write_file(path: str, content: str) -> str:
    """把内容写入文件，父目录不存在会自动创建。"""
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")
    return f"已写入 {len(content)} 个字符到 {path}"


@tool
def list_files(directory
```python
@tool
def list_files(directory: str = ".") -> list[str]:
    """列出目录下的一级条目，目录不存在时返回空列表。"""
    root = Path(directory)
    if not root.exists():
        return []
    return sorted(entry.name for entry in root.iterdir())
```

### 4.8 `tools/terminal.py`

```python
"""终端工具。课里说这两个工具（run_command / run_in_directory）
之前已经写好了，并且正是这两个工具后来被包成了自定义 MCP server。"""

import subprocess
from pathlib import Path

from langchain_core.tools import tool


@tool
def run_command(command: str, timeout: int = 60) -> dict:
    """在当前工作目录执行一条 shell 命令，返回 stdout / stderr / 退出码。"""
    completed = subprocess.run(
        command,
        shell=True,
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    return {
        "stdout": completed.stdout,
        "stderr": completed.stderr,
        "returncode": completed.returncode,
    }


@tool
def run_in_directory(command: str, directory: str, timeout: int = 60) -> dict:
    """在指定目录下执行命令。"""
    target = Path(directory)
    if not target.exists():
        return {
            "stdout": "",
            "stderr": f"目录不存在：{directory}",
            "returncode": 1,
        }

    completed = subprocess.run(
        command,
        shell=True,
        cwd=str(target),
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    return {
        "stdout": completed.stdout,
        "stderr": completed.stderr,
        "returncode": completed.returncode,
    }
```

### 4.9 `observability/logging.py`

```python
"""日志层。课里只说 observability 是独立一层、『下周再缝进来』，
没有给出具体实现，下面是能跑通的最小版本。"""

import logging
import os

LEVEL = os.getenv("LOG_LEVEL", "INFO")

logging.basicConfig(
    level=getattr(logging, LEVEL.upper(), logging.INFO),
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
```

### 4.10 `terminal_command_runner_mcp.py`（自定义 MCP server，放在 `mcp-demo/`）

```python
"""把 terminal 工具包成 MCP server。

讲师原话：『我已经写好了这些工具，不想让别人再重复这份功夫，
就把它暴露成 MCP server，别人就能用。就这么简单。』

运行方式（MCP client 会这么拉起它）：
    python terminal_command_runner_mcp.py
"""

import subprocess
from pathlib import Path

from mcp.server.fastmcp import FastMCP

# 这个名字就是 client 配置里要填的 server 名。
mcp = FastMCP("terminal-commander")


@mcp.tool()
def run_command(command: str, timeout: int = 60) -> dict:
    """在当前工作目录执行一条 shell 命令。"""
    completed = subprocess.run(
        command,
        shell=True,
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    return {
        "stdout": completed.stdout,
        "stderr": completed.stderr,
        "returncode": completed.returncode,
    }


@mcp.tool()
def run_in_directory(command: str, directory: str, timeout: int = 60) -> dict:
    """在指定目录下执行命令。"""
    target = Path(directory)
    if not target.exists():
        return {"stdout": "", "stderr": f"目录不存在：{directory}", "returncode": 1}

    completed = subprocess.run(
        command,
        shell=True,
        cwd=str(target),
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    return {
        "stdout": completed.stdout,
        "stderr": completed.stderr,
        "returncode": completed.returncode,
    }


if __name__ == "__main__":
    # 默认 transport 就是 stdio：client 会把它作为一个子进程拉起来。
    mcp.run()
```

### 4.11 `demo_client.py`（调用自定义 server，放在 `mcp-demo/`）

```python
"""以 STDIO 方式拉起上面那个自定义 server 并调用它的工具。

用绝对路径定位脚本：讲师在这一步踩过两次坑
（先是 Connection closed，后是 no such file or directory），
根因都是子进程的工作目录和相对路径对不上。
"""

import asyncio
from pathlib import Path

from langchain_mcp_adapters.client import MultiServerMCPClient

SERVER_SCRIPT = Path(__file__).resolve().with_name("terminal_command_runner_mcp.py")


async def main() -> None:
    config = {
        "terminal": {
            "transport": "stdio",
            "command": "python",
            "args": [str(SERVER_SCRIPT)],
        }
    }

    client = MultiServerMCPClient(config)
    tools = await client.get_tools()

    print("拿到的工具：", [tool.name for tool in tools])

    run_command = next(tool for tool in tools if tool.name == "run_command")
    result = await run_command.ainvoke({"command": "echo hello from custom mcp server"})
    print("调用结果：", result)


if __name__ == "__main__":
    asyncio.run(main())
```

### 4.12 `mcp-demo/requirements.txt`

```text
mcp
langchain-mcp-adapters
```

> 讲师在这一步说「我在 requirements.txt 里没有 langchain-mcp-adapters，抱歉，得加上」，同时提醒要激活虚拟环境。课里没给出版本号。

### 4.13 `skills/registry.py`

```python
"""Skills 层：实现渐进式披露的第一层。

流程：
1. 扫描 SKILLS_DIR 下的每个子目录；
2. 每个子目录里必须有 SKILL.md；
3. 解析开头的 YAML front matter，取出 name 和 description；
4. 只把 name + description 交给 agent（约 100 token），
   正文指令等模型主动要求时再读（约 5k token）。
"""

import os
import re
from dataclasses import dataclass
from pathlib import Path

from langchain_core.tools import tool

SKILL_FILE = "SKILL.md"

# 匹配开头的 --- ... --- 块，只要求 name / description 两个字段。
_FRONT_MATTER = re.compile(
    r"^---\s*\n(?P<body>.*?)\n---\s*\n(?P<rest>.*)$",
    re.DOTALL,
)


@dataclass
class SkillMeta:
    name: str
    description: str
    path: Path

    @property
    def instructions(self) -> str:
        """被触发时才读正文。"""
        return self.path.read_text(encoding="utf-8")


def _parse_front_matter(text: str) -> tuple[dict[str, str], str]:
    match = _FRONT_MATTER.match(text)
    if not match:
        return {}, text

    meta: dict[str, str] = {}
    for line in match.group("body").splitlines():
        if ":" not in line:
            continue
        key, _, value = line.partition(":")
        meta[key.strip()] = value.strip().strip('"').strip("'")
    return meta, match.group("rest")


def skills_root() -> Path:
    """skill 放在『被操作的项目』里，不在 capstone 项目里。"""
    return Path(os.getenv("SKILLS_DIR", "./skills")).resolve()


def load_skill_index() -> list[SkillMeta]:
    """只读出元数据，不碰正文。"""
    root = skills_root()
    if not root.exists():
        return []

    index: list[SkillMeta] = []
    for directory in sorted(root.iterdir()):
        if not directory.is_dir():
            continue

        skill_md = directory / SKILL_FILE
        if not skill_md.exists():
            continue

        meta, _ = _parse_front_matter(skill_md.read_text(encoding="utf-8"))
        name = meta.get("name", directory.name)
        description = meta.get("description", "")
        if not description:
            continue
        index.append(SkillMeta(name=name, description=description, path=skill_md))

    return index


@tool
def list_skills() -> list[dict]:
    """列出当前项目里可用的 skill（只有名字和描述）。"""
    return [
        {"name": skill.name, "description": skill.description}
        for skill in load_skill_index()
    ]


@tool
def read_skill(name: str) -> str:
    """读取某个 skill 的完整正文，只在确实需要时才调用。"""
    for skill in load_skill_index():
        if skill.name == name:
            return skill.instructions
    return f"没有找到名为 {name} 的 skill。"
```

### 4.14 `skills/code-review/SKILL.md`

```markdown
---
name: code-review
description: 对一段代码做评审，关注可读性、错误处理、边界条件与测试覆盖。当用户要求 review、检查代码质量、找 bug 时使用。
---

# Code Review

以一位在小型工作室带团队的 tech lead 身份来做评审。

## 流程

1. 先通读改动范围，说明这段代码在做什么。
2. 检查错误处理：每个外部调用（网络、文件、子进程）是否都有失败路径。
3. 检查边界条件：空输入、超大输入、并发写入、路径不存在。
4. 检查可读性：命名是否表达意图、函数是否过长、是否有重复逻辑。
5. 检查测试：哪些分支没有测试。

## 输出格式

- 按严重程度分组：阻塞问题 / 建议改进 / 风格问题。
- 每条问题给出文件与行号、原因、以及一段修改后的代码。
- 不要为了凑数量而列风格问题；没有阻塞问题就明确说没有。
```

### 4.15 `main.py`

```python
"""edu-courses-claude 的入口：组装工具、建 agent、跑交互循环。"""

import asyncio

from langchain_core.messages import HumanMessage

from agent.factory import build_agent
from mcp.client import get_mcp_tools
from memory.short_term import ShortTermMemory
from observability.logging import get_logger
from skills.registry import list_skills, read_skill
from tools.file_system import list_files, read_file, write_file
from tools.terminal import run_command, run_in_directory

logger = get_logger(__name__)


async def build_tool_list() -> list:
    """本地工具 + MCP 工具 + skills 工具，在这里合成一个列表。"""
    local_tools = [
        read_file,
        write_file,
        list_files,
        run_command,
        run_in_directory,
        list_skills,
        read_skill,
    ]
    mcp_tools = await get_mcp_tools()
    logger.info("本地工具 %d 个，MCP 工具 %d 个", len(local_tools), len(mcp_tools))
    return [*local_tools, *mcp_tools]


async def main() -> None:
    memory = ShortTermMemory()
    history = await memory.load()

    tools = await build_tool_list()
    agent = build_agent(tools=tools)

    print("edu-courses-claude 已启动，输入 exit 退出。")

    while True:
        try:
            query = input("\n你 > ").strip()
        except (EOFError, KeyboardInterrupt):
            break

        if not query or query.lower() in {"exit", "quit"}:
            break

        # 讲师在 Playwright 演示里强调的调用上限，这里在 agent 配置层给一个兜底。
        result = await agent.ainvoke(
            {"messages": [*history, HumanMessage(content=query)]},
            config={"recursion_limit": 25},
        )

        messages = result["messages"]
        history = messages
        await memory.save(
            [
                {"role": m.type, "content": str(m.content)}
                for m in messages
                if getattr(m, "content", None)
            ]
        )

        last = messages[-1]
        print(f"\nagent > {last.content}")


if __name__ == "__main__":
    asyncio.run(main())
```

### 4.16 `.env.example`

```bash
# 复制成 .env 后填写，然后 source .env
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
MODEL_NAME=gpt-4.1
SKILLS_DIR=./skills
LOG_LEVEL=INFO
```

---

## 5. 逐行解释

### 5.1 为什么 `mcp_servers.json` 必须在项目根

`mcp/client.py` 里用 `Path(__file__).resolve().parent.parent` 定位配置文件，也就是「`mcp/` 的上一级」。这不是随便选的，而是把讲师踩过的那个坑固化进代码：他第一版把 JSON 放进了 `mcp/` 目录，运行时报错，原话是「配置文件的层级搞错了，它应该在 edu-courses-claude 这一层，不该在 mcp 里面」。

如果你把 JSON 放进 `mcp/`，用这个路径就找不到；即使改成 `parent` 也能跑，但一旦有人在别的目录启动脚本（比如 `python -m edu_courses_claude.main`），基于当前工作目录的相对路径就会失效。用 `__file__` 锚定，跟从哪启动无关。**在 JS/Node 里对应什么**：这就是 `__dirname` 而不是 `process.cwd()`，同一个坑。

### 5.2 为什么环境变量替换要「找不到就抛错」

`_resolve_env` 里最关键的一行是 `if name not in os.environ: raise RuntimeError(...)`。讲师的原话是「如果那个变量不在环境里，这段代码就跑不起来」，他把这个行为当成**特性**而不是缺陷。

如果不这样写，改成 `os.environ.get(name, "")`，后果是：MCP server 会带着空 token 正常启动，然后你在调用 GitHub 工具时收到一个 `401 Unauthorized`，而那时错误信息里只会有「authentication failed」，完全看不出根因是「你忘了 export」。fail-fast 的价值就在于把错误压在离根因最近的地方。

`_ENV_PATTERN` 用 `\$\{...\}` 而不是直接匹配 `$GITHUB_TOKEN`，因为裸 `$NAME` 形式在 shell 命令字符串里（比如 `args` 里的 `$HOME`）会误伤——MCP server 的 args 里经常有裸 `$`，加上花括号就明确了「只有这个写法才是占位符」。

递归处理 dict / list 是因为 `env` 是 dict、`args` 是 list，占位符可能出现在任意一层。只处理顶层字符串是复现时最常见的错。

### 5.3 `MultiServerMCPClient` 为什么能「一次建好所有 client」

讲师画的映射关系是「host 里一个 client 对一个 server，一对一」。`MultiServerMCPClient(config)` 接收的就是这个「名字 → 连接参数」的字典，内部对每一项各自建连接。所以：

- 你在 JSON 里加一个 server，`get_tools()` 返回的列表就多一批工具；
- `mcp/client.py` 里的任何一行代码都不用改；
- `agent/factory.py` 更不用改，它压根不知道 MCP 的存在。

这就是讲师反复确认的那件事：「如果我在 JSON 里再加更多 server，factory 要改吗？不用，因为 JSON 里有什么，就加载什么、建 client，这段代码之后不会被碰。」新增 server 的成本 = 改一行 JSON，这是这一层设计的全部意义。

`get_tools()` 是 `async` 的，所以整个调用链要 `await`。讲师说的「唯一的小改动就是所有东西要变成 async」，指的就是这个传染性。

### 5.4 `factory.build_agent` 为什么把 tools 当参数

对比一下「工厂自己 import 工具」和「工厂接收工具列表」这两种写法。前者在新增 MCP server 时必须改工厂，后者不用。讲师的表述是「工具列表由外部传进来，本地工具和 MCP 工具在这里没有区别」——对 agent 来说，工具就是一个有 `name` / `description` / `ainvoke` 的对象，来源不影响任何事。

这也是后面接 Skills 的基础：`list_skills` / `read_skill` 作为两个普通工具混进同一个列表，agent 感知不到它们和 MCP 工具的区别。

### 5.5 短期记忆为什么必须 async

`ShortTermMemory.load` / `save` 都用了 `await`，但内部是同步的 `Path.read_text`。这看起来是「假装异步」，但在这一层的实际作用是：**不阻塞事件循环的语义边界**。MCP 的 `get_tools()`、agent 的 `ainvoke()` 都在同一个事件循环里，如果记忆层是同步阻塞的 `fs` 调用，在文件很大或磁盘慢时会卡住整个 loop。

**在 JS/Node 里对应什么**：从 `fs.readFileSync` 换成 `fs.promises.readFile`。讲师说「短期记忆那边也要把所有东西改成 async」，说的就是这个换法，而不是要你引入线程池。

`.memory/short_term.json` 这个路径对应讲师演示时屏幕上出现的「dot memory is created for the short term memory」——目录是运行时自动建的（`mkdir(parents=True, exist_ok=True)`），不需要你手动创建。

### 5.6 两个终端工具为什么「一模一样」

`tools/terminal.py` 和 `terminal_command_runner_mcp.py` 里的 `run_command` / `run_in_directory` 实现几乎逐字相同。这不是复制粘贴偷懒，而是讲师在演示时的原话意图：「这就是我们之前已经创建的那两个函数，完全一样的函数，唯一不同的是我用 FastMCP 把它做成了一个 server。」

一个函数被「暴露成工具」和「暴露成 MCP server」的区别只在包装层：

| 包装方式 | 装饰器 | 谁调用 |
|---|---|---|
| 本地工具 | `@tool`（LangChain） | 同进程内的 agent |
| MCP server | `@mcp.tool()`（FastMCP） | 任意 MCP client，跨进程 |

所以「我有工具想给别人用」的成本极低——加个装饰器、加个 `mcp.run()` 就完。

### 5.7 `FastMCP("terminal-commander")` 这个名字的去处

构造时传的字符串就是 server 名。讲师在演示 client 时说的是「我用的名字是 terminal commander，这个名字从哪来的？就是我在这里给的名字」——client 配置里的 key（`"terminal"`）是你给这个连接起的本地别名，`FastMCP(...)` 里的是 server 自报的名字，两者不必一致，但保持一致少踩坑。

`mcp.run()` 不带参数时默认就是 stdio transport。这意味着 server 不监听端口，而是从 stdin 读请求、往 stdout 写响应——所以 client 用 `subprocess` 的方式把它拉起来，讲师在屏幕上指出的正是这一点：「它作为一个独立的子进程在跑」。

### 5.8 为什么要用绝对路径起子进程

`SERVER_SCRIPT = Path(__file__).resolve().with_name("terminal_command_runner_mcp.py")` 这一行，直接对应讲师连续两次的报错：先 `Connection closed`，再 `no such file or directory`，他最后的诊断是「文件名不对 / 路径不对」。

根因是：`command: "python"` + `args: ["terminal_command_runner_mcp.py"]` 这种写法，子进程的工作目录取决于 client 进程从哪里启动、以及 adapter 有没有透传 `cwd`。你从 `mcp-demo/` 里运行没问题，从上一级运行就找不到文件。用绝对路径一劳永逸。

还有一个隐藏坑：`command` 写 `"python"` 依赖 PATH 里那个 `python` 是不是你激活的虚拟环境。写成 `sys.executable` 最稳：

```python
import sys
# ...
"command": sys.executable,
```

### 5.9 Skills 的 front matter 为什么是「三个减号夹着 name 和 description」

讲师在讲格式时特意停下来强调：「在这个文本格式里你看到的是表格，但如果看原始文件，你会看到三个减号，中间夹着这些。」这个 `---` 包裹的块就是 YAML front matter，是所有 skill 的强制格式：

```markdown
---
name: xxx
description: yyy
---
```

为什么必须标准化？讲师的答案是「行业里任何东西都需要标准化——如果你要发大 prompt、要发 skill，怎么写出一个任何人都能用的 skill？那就得有一个标准格式」。有了这个格式，任何框架、任何应用都能按同一套规则发现和读取 skill，而不是每家一套。

`_parse_front_matter` 用正则而不是 `yaml.safe_load`，是为了零额外依赖也能跑。如果你已经 `poetry add pyyaml`，换成 `yaml.safe_load(match.group("body"))` 更稳（能处理多行描述、带冒号的值）。正则版本在这两种情况下会出错：`description` 里本身含 `:`（会被 `partition` 切断后面的部分）、`description` 用 `>` 折叠多行。**课里没讲**讲师用的是哪种解析方式，他只在屏幕上展示过格式化后的表格视图。

### 5.10 渐进式披露的三层，代码里怎么对应

讲师把 token 账算得很清楚：「每个 skill 的元数据、name 加 description，大概 100 token，永远都会发；如果这个 skill 被选中，指令大概 5k token；再要资源就再加。」

对应到代码：

| 层 | 内容 | 代码位置 | token 量级 |
|---|---|---|---|
| L1 元数据 | `name` + `description` | `load_skill_index()` 只读 front matter，`list_skills` 返回 | ~100 |
| L2 指令 | `SKILL.md` 正文 | `read_skill(name)` 返回 `skill.instructions` | ~5k |
| L3 资源/脚本 | 同目录下的脚本、参考文件 | **课里没写具体实现**，讲师只说「会有脚本、参考资料，按需加载」 |

关键设计在 `list_skills` 只返回 `{"name", "description"}` 这一点：如果它把整个 `SKILL.md` 内容都返回，10 个 skill 就是 50k token 常驻上下文，这正是讲师回答那个提问时说的——「能不能把这 10 个 skill 全塞进一个 prompt？不行，这不是正确做法」。

`read_skill` 做成**一个工具**而不是「把所有 skill 内容拼进 system prompt」，是因为工具调用是模型主动发起的——模型看到 L1 的描述后自己判断「我需要 code-review 这个 skill」，然后调 `read_skill("code-review")`。这就是「按需」二字的实现方式。

### 5.11 `SKILLS_DIR` 为什么指向「被操作的项目」而不是 capstone

讲师的原话是：「skill 不会在我的 capstone 项目代码里，它会在任何一个 claude code 要运行的项目里。」逻辑是：`edu-courses-claude` 是**工具**，skill 是**针对某个具体项目的领域知识**。你给 A 项目写的 `code-review` 规则，不该出现在 B 项目的上下文里。

所以 `skills_root()` 优先读 `SKILLS_DIR` 环境变量，默认 `./skills`——也就是「当前工作目录下的 skills」，正好等价于「你在这个项目里启动 agent 时，读这个项目自己的 skills」。

`load_skill_index()` 里两个 `continue` 值得注意：目录里没有 `SKILL.md` 就跳过（讲师强调「`SKILL.md` 是必须的，其他脚本、参考都是可选的」），描述为空也跳过（没有描述的 skill 对模型不可发现，留着只会污染列表）。

### 5.12 `config={"recursion_limit": 25}` 这一行的来历

这不是随手的保险，而是直接对应讲师在 Playwright 演示里反复警告的事：「第一次用的时候，如果你不给模型调用和工具调用设上限，它会发起太多调用，最后陷进循环。」他给的数字是「我设了 15 和 5 的上限」，并展示屏幕上 agent 不停地 `open → search → close → open` 循环，说「它一遍又一遍地做同一件事，如果你不设限制，会烧掉非常多的 token」。

`recursion_limit` 是 LangGraph 的硬上限，超了会抛异常而不是继续烧钱。这个值课里讲师用的是 15/5 这一组（具体对应哪两个参数**课里没讲清**），我在这里写 25 是为了给正常的多步任务留余量；你要跑 Playwright 那种任务，按讲师的做法设得更紧更安全。

### 5.13 `requirements.txt` 和 `pyproject.toml` 并存

讲师在 `mcp-demo` 里用 `requirements.txt` + venv，在 capstone 里用 Poetry。两者不冲突：capstone 是「主项目」，走 Poetry；`mcp-demo` 是临时演示项目，用 venv + pip 更快。你复现时完全可以两个都用 Poetry，只要注意**不要在 capstone 根目录里 `pip install`**，否则会污染 Poetry 管理的环境。

---

## 6. 复现检查清单

按顺序勾，每一步都能独立验证，出错就停在这一步。

### 阶段一：MCP 接入 capstone

- [ ] `poetry add langchain-mcp-adapters` 成功，`poetry show langchain-mcp-adapters` 有输出
- [ ] `mcp_servers.json` 存在且**位于项目根目录**（`ls mcp_servers.json` 在 `edu-courses-claude/` 下能看到）
- [ ] `mcp/__init__.py`、`skills/__init__.py` 等空文件都存在
- [ ] `export GITHUB_TOKEN=...` 之后再启动（没设置时应该报「环境变量 GITHUB_TOKEN 未设置」，这是**预期行为**）
- [ ] `poetry run python -c "import asyncio; from mcp.client import get_mcp_tools; print(len(asyncio.run(get_mcp_tools())))"` 能打印出工具数量（>0）
- [ ] 启动 `poetry run python main.py`，日志里能看到 `.memory` 目录被创建
- [ ] 日志里能看到「本地工具 N 个，MCP 工具 M 个」，M 不为 0
- [ ] 屏幕上出现 GitHub MCP server 已启动的迹象（讲师演示时是看到 `github mcp server is running`）
- [ ] 输入 `list all the files in my GitHub repository`，agent 调用了 MCP 工具并返回文件名列表
- [ ] 如果不返回文件：token 权限不够（讲师说过「推文件、建 PR 都能做，取决于你 token 的权限」），先确认 token 有 `repo` scope

### 阶段二：验证「加 server 不用改代码」

- [ ] 在 `mcp_servers.json` 里加 `playwright` 段
- [ ] **不改任何 .py 文件**，重启，日志里 MCP 工具数量变多
- [ ] `git diff --stat` 里只有 JSON 一个文件被改

### 阶段三：自定义 MCP server

- [ ] 在 `mcp-demo/` 里 `pip install -r requirements.txt` 成功
- [ ] `python terminal_command_runner_mcp.py` 直接运行不报 ImportError（会挂在那里等 stdin，Ctrl+C 退出，这是正常的）
- [ ] `python demo_client.py` 打印出 `["run_command", "run_in_directory"]`
- [ ] `demo_client.py` 打印出 `hello from custom mcp server`
- [ ] 如果你遇到 `Connection closed` 或 `no such file or directory`：检查 `SERVER_SCRIPT` 是否是绝对路径，`command` 是否是 `sys.executable`

### 阶段四：Skills

- [ ] 目标项目里有 `skills/code-review/SKILL.md`，且文件开头就是 `---`（前面不能有空行或 BOM）
- [ ] `export SKILLS_DIR=/path/to/target-project/skills`
- [ ] `poetry run python -c "from skills.registry import load_skill_index; print([s.name for s in load_skill_index()])"` 打印出 `['code-review']`
- [ ] 启动 agent 问「你现在有哪些 skill 可以用」，agent 调 `list_skills` 并报出 `code-review` 和它的描述
- [ ] 问「帮我 review 一下 xxx.py」，agent 先调 `list_skills` 判断，再调 `read_skill("code-review")`，然后按 `SKILL.md` 里定义的分组格式输出
- [ ] 故意把 `SKILL.md` 的 `description` 删掉，重启后 `load_skill_index()` 不再返回它（验证「没描述的 skill 不可发现」）

### 阶段五：Playwright（谨慎）

- [ ] 已确认 `recursion_limit` 设成了小值
- [ ] 运行前盯着 token 消耗
- [ ] 观察到 agent 完成一次搜索后**主动停止**，而不是 `open → search → close` 循环
- [ ] 如果停不下来：立即 Ctrl+C，把 `recursion_limit` 调小再试

---

## 7. 课里没讲但你会撞上的

### 7.1 你的 `mcp/` 包会遮蔽 pip 装的 `mcp` 包

这是本节最隐蔽的坑。capstone 根目录下有一个名为 `mcp` 的本地包（就是你新建的那个 `mcp/` 文件夹 + `__init__.py`），而你要 `import mcp` 来用 FastMCP 时，Python 会优先找到**项目目录下的 `mcp/`**，于是报：

```
ModuleNotFoundError: No module named 'mcp.server'
```

或者更迷惑的 `ImportError: cannot import name 'FastMCP' from 'mcp'`。

课里没讲这件事，但讲师的做法其实已经避开了它：他写自定义 MCP server 时**关掉了 capstone 项目，另开了一个 `mcp-demo` 项目**，那个项目里没有本地 `mcp/` 包，所以 `import mcp` 拿到的是 pip 装的包。你照做就不会撞上。如果你非要在 capstone 里写 MCP server，把本地包改名为 `mcp_client` 或 `mcp_layer`。

### 7.2 `npx` 第一次运行会很慢，看起来像卡死

`npx -y @modelcontextprotocol/server-github` 第一次执行时要把整个 npm 包下载到 `~/.npm/_npx` 缓存里，几十秒到几分钟都有可能。这期间 `get_mcp_tools()` 一直 `await`，屏幕上什么都没有，你会以为代码写错了。

课里没讲，但验证方法很简单：先在终端手动跑一次 `npx -y @modelcontextprotocol/server-github`，等它把包装好（会挂在那里等 stdin，Ctrl+C 退出），再跑你的代码就快了。同理，Playwright MCP 首次运行还要额外下载 Chromium。

另外讲师那句「如果你没有 NodeJS，会直接报错」——报的不是「找不到 npx」，而是 `FileNotFoundError: [Errno 2] No such file or directory: 'npx'`，因为子进程启动失败。看到这个错误先 `node -v`。

### 7.3 GitHub MCP server 的包名在变

讲师只说了「npx 加参数」，没念包名。`@modelcontextprotocol/server-github` 这个包在 npm 上曾经被标记 deprecated，官方推荐用 Docker 镜像 `ghcr.io/github/github-mcp-server`。如果你 `npx` 那条报错，直接切 Docker 版本（4.1 里给了现成配置），JSON 结构一个字都不用改——这正是「配置驱动」的好处。

同理 Playwright MCP 的包名，`@playwright/mcp@latest` 是当下的写法，变动时去官方 README 抄。

### 7.4 `transport` 字段的两种取值

课里出现的值是 `stdio` 和「streamable HTTP」（讲师说的是 "streamable HTTP"，不是简单的 "http"）。如果你的 adapter 版本对 `transport` 取值报校验错，列出它能接受的值看看：

```bash
poetry run python -c "from langchain_mcp_adapters.client import MultiServerMCPClient; import inspect; print(inspect.getsource(MultiServerMCPClient.__init__))"
```

课里没讲字段名的其他可能取值，以你装的版本实际接受为准。

### 7.5 用 HTTP transport 时 `mcp_servers.json` 长什么样

讲师说「切换 transport 很简单，唯一的区别是给它 URL」，但没展示完整配置。按 MCP 规范，大致是这样（**课里没给具体字段名**，以下是规范草案，字段请以你用的版本为准）：

```json
"remote_server": {
  "transport": "streamable_http",
  "url": "http://localhost:8000/mcp"
}
```

注意讲师强调过一件容易被误解的事：「streamable HTTP 你也可以在本地用，不一定是远程。」只要把它跑起来并给出 URL，本机也能用 HTTP transport，区别只是「有没有独立进程 + 端口」。

### 7.6 Skills 的 L3（资源与脚本）完全没有代码

讲师明确说过 skill 里「可以有脚本、有参考资料」，也展示了 pdf / pptx 这类 skill 目录里除 `SKILL.md` 之外还有别的文件，但**这一节没有写任何加载 L3 的代码**。他停在 `skills/registry.py`，只讲到「提取 name 和 description 发给 agent」这一步。

所以：`read_skill` 只返回正文文本。如果你想支持 L3，需要自己设计「正文里怎么引用同目录的资源文件」的约定，课里没讲，别当作已有规范。

### 7.7 `create_deep_agent` 这条路被讲师刻意跳过了

讲师展示了 `create_deep_agent(skills=[...])` 这种一行接入 skills 的写法，然后明确说：「如果目的只是用 skill，就这么简单。但我们这门课要做的是理解内部发生了什么，所以我们不用 `create_deep_agent`，而是用 `create_agent` 自己写内部实现。」

所以：
- 想快速用 → `create_deep_agent`，但那需要你装 LangChain 的对应包（**课里没讲是哪个包**）；
- 想理解 → 走 4.13 的手写 registry；
- 讲师**没有**让你在 capstone 里同时用两者。

### 7.8 别把 `SKILLS_DIR` 指到 capstone 自己的 `skills/`

`skills/` 在 capstone 里是**代码层**（`registry.py` 住的地方），而 skill 文件要放在**被操作的项目**里。这两个目录同名但用途不同，`SKILLS_DIR` 指向后者。指错了的现象是：`load_skill_index()` 返回空列表，因为它扫的是 `skills/` 下的子目录，那里只有 `__init__.py` 和 `registry.py`，没有 `SKILL.md`。

### 7.9 前端视角的迁移对照

| 这一节的概念 | 你在 Node 里的对应物 |
|---|---|
| `MultiServerMCPClient` 多 server | 一个 fan-out 的 `Promise.all`，每个 server 一个独立连接 |
| `async` 传染到记忆层 | `fs.readFileSync` → `await fs.promises.readFile` |
| `mcp_servers.json` + 环境变量替换 | 和 `dotenv` 展开 `${VAR}` 一模一样 |
| Skills 的 L1 元数据 | 像 package.json 的 `name` + `description`：`npm search` 时只看这两项 |
| 渐进式披露 | 动态 `import()`：先看路由表里的名字，点进去才下载 chunk |
| `recursion_limit` | 给递归函数加个 depth 参数，超了就 throw |
| STDIO transport | 用 `child_process.spawn` 起一个进程，通过 stdin/stdout 通信（本质就是这个） |

### 7.10 关于「找 skill 去哪找」

讲师给了几个线索，都不在本节代码范围内：

- Anthropic 官方 skills 仓库（他说「157k stars、18.5k forks」，并强调「这不是随便的东西，是很被行业接受的标准，就像 Anthropic 先做出 MCP 一样，skills 也是他们先推的」）；
- 还有别的社区目录，可以按 star 数筛选（他的建议是「优先用 star 多的」，并提到 `pdf` 相关 skill）；
- 具体能用在 capstone 里的：code review、testing/QA、DevOps、数据库、设计/UX（其中前端设计那个他给了链接）。

这些仓库的目录结构、安全扫描规则**课里没讲细节**，只提到「它们会扫，有安全规则」。用之前自己读一遍 `SKILL.md` 内容——它会被送进你的模型上下文，等于第三方代码进你的 prompt。
### 7.11 多 server 时，工具名会撞车

`get_tools()` 把每个 server 的工具摊平进同一个列表。如果两个 server 都导出了名为 `read_file` 的工具（filesystem server 和自己写的 terminal server 很容易撞），LangChain 这边会出现两种情况之一：后注册的覆盖先注册的，或者 schema 校验直接报重名。

课里没讲这件事，因为讲师演示时用的 GitHub + filesystem 两个 server 工具名不重叠。但你一旦按 3.9 把自己写的 server 也挂进 `mcp_servers.json`，`run_command` 就会和本地 `tools/terminal.py` 里的 `run_command` 同名——本地工具在前、MCP 工具在后，模型看到的是两个同名不同实现的工具。

最省事的排查方式是在启动时打印一次全量工具名：

```python
# 临时插在 main.py 的 build_tool_list 里
names = [t.name for t in tools]
dupes = {n for n in names if names.count(n) > 1}
if dupes:
    logger.warning("工具名重复：%s", dupes)
```

真撞了就改名，比如 MCP server 端把 `@mcp.tool()` 装饰的函数写成 `mcp_run_command`，或者 client 侧在拿到工具后统一加前缀：

```python
for tool in mcp_tools:
    tool.name = f"mcp__{tool.name}"
```

### 7.12 工具越多，`list_skills` 式的常驻开销越大

讲师在课上回应过一条弹幕：

> "Amit 说他在配置里加了一个选项，可以从 MCP server 里只挑特定工具、而不是全部工具，这非常好，是个很棒的后续。"
> —— p009 [19:23]

这条被讲师当场表扬的改动，价值随着 server 数量增长而放大。原因是每个工具的 `name` + `description` + 参数 schema 都要进上下文，一个 server 导出 30 个工具，光工具定义就可能吃掉几千 token，而且**每轮对话都在**。

同理，`list_skills` 返回的是全部 skill 的 name + description。讲师算过账：「每个 skill 的元数据大概 100 token，永远都会发。」10 个 skill 就是 1000 token 常驻，50 个就是 5000 token——这就和「L2 正文 5k token」一个量级了，渐进式披露省下来的东西又被 L1 吃回去。

课里没讲怎么解决。可行的两个方向：一是给 `list_skills` 加 `query` 参数做关键字过滤（等于把「发现」这一步从「全量列举」改成「按需搜索」）；二是在配置里只挑特定工具（就是 Amit 那条）。两者都超出本节代码范围，属于你自己要补的设计。

### 7.13 `SKILL.md` 开头必须有 `---`，且中间不能夹东西

`_parse_front_matter` 的正则是 `^---\s*\n...`，它要求**文件第一个字符就是 `-`**。三种常见的手滑会让它匹配失败：

1. **UTF-8 BOM**。Windows 记事本、某些编辑器保存时会塞一个 BOM 在文件头，Python 用 `encoding="utf-8"` 读进来是 `\ufeff---`，`^---` 匹配不上。症状是 `load_skill_index()` 返回空列表，但文件内容你肉眼看是对的。修法：编辑器里另存为「UTF-8 无 BOM」，或者读的时候用 `encoding="utf-8-sig"`。
2. **front matter 之前有空行或标题**。有些模板会在 `---` 上面加个 `# Skill: xxx`，这直接违反「front matter 必须在最开头」的约定。
3. **`---` 后面没有换行**。写成 `--- name: code-review ---` 一行流不合法，必须是三行结构。

另外我的 `load_skill_index()` 只往下扫**一层**子目录。如果你按 `skills/pdf/merge/SKILL.md` 这种方式组织（很多官方仓库确实是嵌套的），它就找不到了。课里没讲讲师打算支持几层，他的表述是「每个 skill 一个文件夹，文件夹里必须有 `SKILL.md`」，按字面就是一个 skill 一层。要支持嵌套就把 `iterdir()` 换成 `rglob(SKILL_FILE)`，但要注意别把 `node_modules` 扫进来。

### 7.14 `.memory/short_term.json` 会无限长

`ShortTermMemory.save` 每次都把**完整的** `messages` 写盘，而这些 message 里包含每一条工具调用和工具返回（`read_file` 读到的整个文件内容、`run_command` 的完整 stdout）。跑十几轮之后，这个 JSON 会大到每次启动都卡。

课里没讲裁剪策略。前端视角对照：这就是 Redux store 里塞了全量日志，你迟早要加 `slice(-N)`。最小的做法是在 `save` 之前截断：

```python
MAX_MESSAGES = 40

async def save(self, messages: list[dict]) -> None:
    trimmed = messages[-MAX_MESSAGES:]
    ...
```

更狠一点是在截断时把工具返回的长文本替换成 `"[已省略 N 字符]"`，只保留角色和摘要。注意别把「工具调用」和「工具结果」这对拆开——`AIMessage` 带 `tool_calls`、紧接着的 `ToolMessage` 必须成对存在，否则下一轮 `ainvoke` 会报 schema 错。

### 7.15 `shell=True` 的安全边界，以及它在 Windows 上的行为差异

`tools/terminal.py` 和自定义 MCP server 里都用了 `subprocess.run(command, shell=True)`。这意味着模型生成的任意字符串都会交给系统 shell 执行——不加 shell 就支持的管道、`&&`、环境变量展开全都不行，加了就没有任何沙箱。讲师在课上完全没讨论这个（他在 24:06 说的是「你可以把 cloud code 做成 MCP server 暴露给别人」，也就是把这份能力对外开放），你要在生产里用必须自己加白名单或容器隔离。

Windows 差异：`shell=True` 在 Windows 上走 `cmd.exe`，所以 `ls`、`rm`、`cat` 全部不存在，`mkdir -p` 也不认，`export X=1` 更不认。模型会按 Linux 习惯生成命令，于是在你的机器上稳定失败。最省事的做法是在 system prompt 里明确写当前平台（`platform.system()`），或者干脆在 Windows 上把 shell 换成 `powershell -Command`。

还有一个纯 Python 的坑：`capture_output=True` + `text=True` 时，如果子进程输出里有非 UTF-8 字节（比如 `git` 输出中文路径），Windows 默认编码不是 UTF-8，会抛 `UnicodeDecodeError`。加 `encoding="utf-8", errors="replace"` 能兜住。

### 7.16 `.env` 文件不会自动被读进来

`mcp/client.py` 里 `os.environ[name]` 读的是**进程环境变量**。我从头到尾都写 `export GITHUB_TOKEN=...`，这是讲师的做法（他说的就是「从环境变量加载」）。但如果你习惯在项目里放一个 `.env`（4.16 给了模板），**Poetry 不会自动读它**——`poetry run` 不会加载 `.env`。

课里没讲怎么加载 `.env`。两个办法：一是启动前手动 `set -a; source .env; set +a`（`set -a` 让 source 进来的变量自动 export），二是在 `main.py` 最顶上装个 `python-dotenv` 然后 `load_dotenv()`。后者更省心，但要记住它必须在 `from mcp.client import get_mcp_tools` **之前**执行——因为 `load_mcp_config()` 是在函数调用时读环境变量的，只要你没在 import 阶段就建 client，顺序其实不影响。稳妥起见还是放最前面。

### 7.17 Skills 和 MCP 到底什么关系

讲师在指路时提过讲义里有对比页：

> "你也可以读一读 skills、skills 和 mcp 的对比、以及入门这些内容。"
> —— p009 [64:11]

但他**没有在课上展开讲这个对比**，所以结论要你自己去读那页。我能从本节内容里确定的事实是：

| 维度 | MCP | Skills |
|---|---|---|
| 本质 | 协议：规定工具怎么暴露、怎么使用 | 约定：规定指令和资源怎么放、怎么被发现 |
| 传输 | STDIO / streamable HTTP | 就是文件系统，没有传输层 |
| 谁能写 | 要会写 server 代码 | 讲师原话：「不需要技术背景，市场、产品经理、任何领域的人都能写」 |
| 加载方式 | client 连 server，`get_tools()` | 扫目录，读 `SKILL.md` 的 front matter |
| 和 agent 的关系 | 工具，模型可以**调用** | 上下文，模型**读到**后按它说的做 |

一句话概括：MCP 给 agent **能力**（能干新事），Skills 给 agent **知识**（知道该怎么干）。两者在本节代码里都表现为「塞进工具列表的东西」，所以接起来毫不费力。

### 7.18 「看懂了」和「写出来了」之间隔着全部 bug

讲师在讲 Playwright 以及回应弹幕时，反复强调练习这件事，这是本节唯一带情绪的段落：

> "直到你自己亲手写代码、亲手实践，你才不会觉得没底。这一点对任何主题都成立。"
> —— p009 [43:50]

![p009 43:30 讲师回应聊天区提问：代码要自己动手写才能建立信心](images/p009_2610s.jpg)

> "我的工作是解释概念、尽可能多地给你代码、给你 quiz 和笔记来检验理解，但最终主要的工作量必须是你自己去跑代码。"
> —— p009 [44:20]

他同时提到有同学反馈「写代码时碰到更多 bug，反而从 bug 里学到更多」，他的回应是「很好」。

落在本节，最值得亲手敲一遍的是三段，因为它们各自代表一种「复制粘贴不会暴露问题」的坑：

1. **`_resolve_env`**：故意把 `GITHUB_TOKEN` unset，确认它抛的是你写的那句中文错误，而不是后面某个 401。
2. **自定义 server 的启动**：故意把 `args` 改成相对路径，从上一级目录运行，复现 `no such file or directory`；再改成绝对路径确认修好。这个坑讲师本人踩了两次。
3. **`load_skill_index`**：故意造一个 `description` 为空的 skill、一个没有 `SKILL.md` 的目录、一个带 BOM 的文件，确认三者都被正确跳过（或正确报错），而不是静默返回空列表。

### 7.19 复现失败时的最小二分排查法

本节链路长（环境变量 → JSON → client → async → agent → 记忆），出错时不要从头读代码，按这个顺序二分：

1. **配置层**：`poetry run python -c "from mcp.client import load_mcp_config; print(load_mcp_config())"`。能打印出替换后的 dict，说明 JSON 位置对、占位符换成功了。
2. **连接层**：`poetry run python -c "import asyncio; from mcp.client import get_mcp_tools; print([t.name for t in asyncio.run(get_mcp_tools())])"`。打印出工具名说明 client 建起来了、子进程起来了。卡在这里基本都是 npx 下载慢或 Node 没装（见 7.2）。
3. **集成层**：跳过 agent，直接 `await` 一个 MCP 工具（照 `demo_client.py` 的写法）。能拿到结果说明工具本身没问题，问题在 agent 或提示词。
4. **agent 层**：把 `recursion_limit` 调到 5，问一个只需要一次工具调用的问题，看它会不会调。不调就是工具描述没写清或 system prompt 太模糊。
5. **记忆层**：临时让 `ShortTermMemory.save` 变成空操作，看问题是否消失。会消失就是 message 序列不合法（工具调用没配对）。

这套顺序之所以有效，是因为每一层都能被一个**单行命令**独立验证，不用启动整个 agent。

---

## 附 A：本节术语速查

| 术语 | 本节里的含义 | 出现位置 |
|---|---|---|
| host | 你的 agent 应用（edu-courses-claude） | [06:04] |
| client | host 内为每个 server 建一个的连接对象，一对一 | [06:04] |
| server | 暴露一组工具（tool set / toolkit）的进程 | [05:06] |
| STDIO | server 跑在本机、作为子进程被拉起时的 transport | [06:30] |
| streamable HTTP | server 跑在别处（或本机但独立进程）时的 transport，靠 URL 连 | [06:57] |
| `MultiServerMCPClient` | 一次为多个 server 建 client 的类 | [12:56] |
| progressive disclosure | 元数据常驻、正文触发时加载、资源按需加载 | [56:37] |
| front matter | `SKILL.md` 开头 `---` 夹着的 name + description | [57:37] |
| L1 / L2 / L3 | 元数据（~100 token）/ 指令（~5k）/ 资源与脚本 | [59:55] |
| `SKILL.md` | 每个 skill 目录里必须存在的文件 | [59:00] |

## 附 B：本节在课程里的位置

- **往前接**：MCP 的概念、GitHub server 的 demo、`tools/` 里的 filesystem 与 terminal 工具，都在前面几节做完了。本节只是「接线」，没有新原理。
- **本节新开**：`mcp/` 与 `skills/` 两个新层，加上一次全链路 async 化。
- **往后接**：讲师在开头说得很清楚——「这周覆盖的是整门课最难的题目……剩下的都是些小东西，下周把它们缝起来」，并点名 observability 和 LLM 层。所以 `observability/logging.py`（4.9）和 `llm/provider.py`（4.5）在本节只是占位，别期待它们有完整实现。
- **未完成的部分**：Skills 的 L3 加载、`create_deep_agent` 路线、把 edu-courses-claude 自身暴露成 MCP server——这三件讲师都明确说了存在，但本节都没做。