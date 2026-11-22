# Claude MCP Masterclass — 企业架构与生产部署（P17–P18）

> 课程：Claude MCP Masterclass (生产级 MCP 集成)（BV1SZgy6qEPh）
> 覆盖：P17 Enterprise Architecture、P18 Production Deployment
> 读者定位：前端转 AI 应用工程师。本段课程**以架构讲解与部署流程为主，讲师没有在屏幕上敲代码**，因此第 4 节「完整代码」中的 Dockerfile、docker-compose.yml 等文件，是根据讲师口述的组件与流程整理出的**可直接落盘的完整文件**，凡属推断补全处均已标注；课里没讲的部分明确写「课里没讲」。

---

## 1. 这一节做什么

P17 和 P18 是这门 MCP 课程从「会写 MCP Server」跨到「能把 MCP Server 跑在生产上」的两讲。

- **P17（企业架构）** 回答一个问题：当 MCP 从「一个人笔记本上的一个 server」变成「一个组织几十个 server、几百个 tool、多个业务部门共用」时，架构要怎么设计。讲师给出四条企业级特征（可扩展、可靠、安全、快），并从单体 server 演进到模块化多 server 平台，讲了服务边界划分、共享库、配置与密钥管理、部署形态选型、监控指标、纵向/横向扩容，最后收束到一张参考架构和五条原则。
- **P18（生产部署）** 回答另一个问题：一个已经能跑的 MCP Server，怎么变成「7×24 可用、能自动扩缩、能安全回滚、能被观测」的生产服务。讲师按生命周期讲：Docker 容器化 → Docker Compose 多服务编排 → 云平台部署 → CI/CD 流水线 → 语义化版本 → 监控与维护 → 最佳实践，最后用一段演示把「本地 → 容器 → 编排 → 镜像仓库 → 云 → 监控」整条链路串起来。

两讲的关系是：**P17 是「画图纸」，P18 是「照着图纸施工」**。本文档按「先架构决策、再落地部署」的顺序重组，让你读完能自己把一台本地 MCP Server 容器化、用 Compose 拉起 PostgreSQL + Redis、推镜像、上云、配监控。

---

## 2. 讲师原话

> "企业级 MCP 平台由四个特征定义：可扩展性、可靠性、安全性和速度。可扩展性意味着你的架构能随着组织扩张而增长；可靠性确保 AI 驱动的服务在用户需要时始终可用；安全性提供对工具、资源和敏感数据的受控访问；最后，速度让开发团队能更快、更一致地交付新的 AI 能力。"
> —— p017 [00:28]

> "想想银行、航空公司、医疗提供方或大型科技公司这类企业。它们不可能依赖某个人笔记本上跑的一个 MCP server。它们需要的是一套设计良好的架构，支持多个业务单元、集中式治理和企业级运维。"
> —— p017 [00:57]

> "想象 10 个部门各自独立构建自己的 MCP 工具。很快，多个团队在实现相同的认证逻辑、创建重复的集成、维护各自的配置。这会导致工具重复、配置蔓延、安全不一致，以及对系统健康度缺乏可见性。"
> —— p017 [02:25]

> "企业架构中最重要的概念之一是模块化。与其构建一个处理所有事情的大一统 MCP server，企业组织把职责划分到多个按领域划分的 server 上。"
> —— p017 [03:22]

> "作为最佳实践，永远问自己：这个功能属于这个 server 吗？如果答案不明显，通常说明你的服务边界需要重新细化。"
> —— p017 [04:47]

> "一个客户数据 server 永远不应该包含财务工具。混合业务关注点会造成归属混乱、增加依赖，并且常常引入不必要的安全风险。"
> —— p017 [05:16]

> "企业 MCP 系统应遵循几条指导原则。第一，一个 server 一个领域，每个 server 应代表一项具体的业务能力。第二，建立清晰的职责，让每个团队都明白自己拥有什么。第三，最小化服务之间的依赖，一个 server 对另一个依赖越少，你的架构就越有韧性。最后，通过共享库而不是跨项目复制代码来消除重复逻辑。"
> —— p017 [05:45]

> "如果某个 server 宕机或需要维护，生态系统的其余部分应该继续正常运行。记住，架构不只是关于技术，它是关于让团队能高效、独立地工作。"
> —— p017 [06:13]

> "与其为每个项目重写通用功能，企业团队会创建可在整个 MCP 生态中复用的组件。认证就是一个完美的例子。团队可以使用一个集中式认证库，确保所有 server 的身份管理一致。同样，共享日志库提供标准化的审计轨迹，并改善整个平台的可观测性。数据库访问是另一个常见的共享库候选：连接池、ORM 层和查询工具可以打包一次、到处复用。同样的原则也适用于错误处理和配置管理。"
> —— p017 [07:08]

> "企业 MCP 系统遵循一条简单规则：把一切外部化。配置应该存在于代码库之外，在运行时注入。这让团队能在多个环境部署同一个应用，而无需修改源代码。"
> —— p017 [09:27]

> "敏感信息绝不应存储在仓库中。组织会使用 AWS Secrets Manager、HashiCorp Vault 或云原生的密钥管理服务来安全地存储和获取凭据。"
> —— p017 [09:56]

> "企业组织有几种部署选项，各有优劣。最简单的一层，你可以把 MCP server 部署在本地基础设施或本地硬件上。虚拟机提供隔离环境，在传统企业环境中很常见。容器（如 Docker）在开发和生产之间提供可移植性和一致性。对于更大规模的部署，Kubernetes 提供编排、自动扩缩和高可用。最后，云平台提供托管服务，减少运维开销并简化全球部署。"
> —— p017 [10:52]

> "无论你选择哪种技术，企业部署都有三个共同目标。第一，高可用，不应存在单点故障。第二，易于更新，组织希望尽可能实现零停机部署。第三，灾难恢复，系统必须能从意外故障中快速恢复。"
> —— p017 [11:49]

> "没有监控，组织本质上是在盲飞。他们不知道哪些工具在被使用、瓶颈在哪里、用户是否遇到了问题。企业 MCP 系统应跟踪几个关键指标：工具使用量、响应延迟、错误率、资源消耗和活跃连接数。"
> —— p017 [12:47]

> "现代监控栈通常包括 Prometheus、Grafana、OpenTelemetry 和集中式日志平台等工具。这些方案提供仪表盘、告警和追踪能力，这些对生产环境至关重要。一条好的经验法则是：如果你无法度量它，你就无法改进它。"
> —— p017 [13:44]

> "纵向扩容意味着通过增加更多 CPU、内存或存储来提升单台服务器的容量。这种方法简单，对小负载有效，但有极限。横向扩容则不同：不是造更大的服务器，而是部署更多服务器实例，用负载均衡把流量分发到它们上面。企业组织压倒性地偏好横向扩容，因为它提升容错能力。"
> —— p017 [14:39]

> "在设计 MCP 平台时，永远为增长做规划。当扩容从架构一开始就被纳入考虑，而不是事后补丁，它会容易得多。"
> —— p017 [15:38]

> "五条原则定义了这个架构。第一，模块化设计确保每个 server 有明确的目的和归属模型。第二，共享库消除重复逻辑并提升一致性。第三，集中式监控提供完整的运维可见性。第四，自动化部署实现快速的零停机发布。最后，横向可扩展性确保平台能随组织需求一同增长。"
> —— p017 [16:36]

> "Docker 从根本上改变了现代应用的构建和部署方式。它不再让你担心开发、测试和生产环境之间的差异，而是把你的 MCP 应用及其所有依赖打包进一个可移植的容器，无论在哪里运行行为都完全一致。这解决了软件开发中最古老的问题之一：在我机器上能跑。"
> —— p018 [01:26]

> "每个 Docker 部署的核心都是 Docker 镜像。镜像包含运行应用所需的一切，包括操作系统依赖、源代码、库和启动指令。流程从 Dockerfile 开始。在我们的例子里，我们从一个 Python 3.12 基础镜像开始，把应用复制进容器，定义工作目录，安装所需依赖，并指定启动 MCP server 的命令。"
> —— p018 [03:22]

> "一条简单的命令，比如 docker build -t mcp-server，就能生成一个可复用的镜像。"
> —— p018 [04:19]

> "Docker Compose 允许开发者用单个 YAML 文件定义整个应用栈。在我们的例子里，这个栈包括一个 MCP server、PostgreSQL、Redis 以及额外的支撑服务。与其手动启动每个组件，Docker Compose 用一条命令就把所有东西一起拉起来：docker compose up。"
> —— p018 [05:45]

> "典型的云部署工作流从构建 Docker 镜像开始。然后镜像被推送到容器仓库，比如 Docker Hub 或云厂商专属的仓库。接着镜像被部署到云平台，运行在托管基础设施上。最后，监控工具跟踪系统健康、性能和可用性。"
> —— p018 [08:08]

> "一个典型的 CI/CD 流水线遵循一个直截了当的顺序：开发者把代码提交到仓库，执行自动化测试，构建 Docker 镜像，把应用部署到目标环境，监控系统验证一切正常。整个过程可以在代码变更后的几分钟内自动完成。"
> —— p018 [09:33]

> "一个被广泛采用的方案是语义化版本。像 1.4.2 这样的版本号由三部分组成：主版本号表示破坏性变更，次版本号引入新功能同时保持兼容，修订号代表缺陷修复和小改进。版本化应超越源代码：Docker 镜像、API 契约、MCP 工具、数据库 schema 和配置文件都应被一致地版本化。"
> —— p018 [11:28]

> "监控从收集正确的指标开始。团队应跟踪 CPU 利用率、内存消耗、响应时间、错误率和活跃连接数。维护活动同样重要：依赖必须定期更新以修复安全漏洞，日志应被审查以识别异常行为，备份应被验证，容量规划应被执行以确保系统能承载未来增长。"
> —— p018 [13:22]

> "第一，把一切容器化。Docker 提供跨环境的一致性并简化部署。第二，用 CI/CD 流水线自动化部署，减少人工错误、提升发布速度。第三，持续监控，让问题在影响用户之前被发现。"
> —— p018 [14:47]

> "一个生产系统应具备五个基本特征：它必须可靠、安全、可观测、可扩展、可恢复。如果缺少其中任何一项，长期维护都会变得显著困难。"
> —— p018 [15:44]

> "构建软件只是挑战的一半。交付、运维和维护软件才是最终决定其成败的部分。"
> —— p018 [18:03]

> "我们将从一台本地运行的 MCP server 开始。第一步是创建一个 Dockerfile，把应用及其所有依赖打包进一个可移植容器。镜像构建完成后，我们会在本地测试它，验证 server 的行为完全符合预期。接着，我们会创建一个 Docker Compose 配置，把 MCP server 连同 PostgreSQL 和 Redis 等支撑服务一起启动。用一条命令，我们拉起整个应用栈并确认所有服务通信正常。验证本地环境之后，我们会把 Docker 镜像推送到容器仓库，并部署到 AWS、Azure、Google Cloud 或 Railway 这样的云平台。最后，我们会配置监控、健康检查和日志，确保部署保持可观测和可靠。"
> —— p018 [18:30]

---

## 3. 从零复现

本节把 P17 的架构决策和 P18 的部署流程合成一条可执行的施工路线。**注意：P17 是纯架构讲解，没有可执行代码；P18 讲师口述了 Dockerfile 的结构和 docker compose up 命令，但没有在屏幕上逐行敲。** 下面的文件是按讲师口述的组件（Python 3.12 基础镜像、复制应用、工作目录、安装依赖、启动命令；Compose 栈含 MCP server + PostgreSQL + Redis）整理出的完整可运行版本，凡推断处标注。

### 步骤 0：准备本地 MCP Server（前置条件）

课里假设你已经有一个能跑的 MCP Server（P17 之前模块的产物）。如果你还没有，先准备一个最小可运行的 Python MCP server 目录：

```
mcp-server/
├── server.py
├── requirements.txt
└── Dockerfile          # 步骤 1 创建
```

`server.py` 用官方 MCP Python SDK 写一个最小 server（课里没讲具体 SDK 代码，以下为最小示意，能跑通即可）：

```python
# server.py —— 最小 MCP server 示意（课里没给具体实现，此为可运行最小版）
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("demo-server")

@mcp.tool()
def add(a: int, b: int) -> int:
    """两数相加"""
    return a + b

if __name__ == "__main__":
    # 以 stdio 传输启动，便于容器内被客户端调用
    mcp.run()
```

`requirements.txt`：

```
mcp>=1.0.0
```

> 说明：`mcp` 包版本请以你实际安装到的为准；课里没讲具体版本号。

### 步骤 1：写 Dockerfile（P18 核心）

讲师原话描述的结构：**Python 3.12 基础镜像 → 复制应用 → 定义工作目录 → 安装依赖 → 指定启动命令**。对应完整文件见第 4 节。构建命令：

```bash
docker build -t mcp-server .
```

讲师原话是 `docker build -t mcp-server`（p018 [04:19]），末尾的 `.` 是构建上下文，必须带上才能构建当前目录。

### 步骤 2：本地测试镜像

```bash
docker run --rm -it mcp-server
```

验证 server 行为与本地直接 `python server.py` 一致。课里强调「在本地测试它，验证 server 的行为完全符合预期」（p018 [18:30]）。

### 步骤 3：写 docker-compose.yml，拉起 MCP server + PostgreSQL + Redis

讲师明确说 Compose 栈包含「一个 MCP server、PostgreSQL、Redis 以及额外的支撑服务」（p018 [05:45]）。完整文件见第 4 节。启动：

```bash
docker compose up
```

（讲师原话是「docker compose up」，p018 [06:12]。加 `-d` 可后台运行，课里没讲这个参数，属常用补充。）

### 步骤 4：推镜像到容器仓库

讲师给的云部署工作流第一步是构建镜像、第二步推送到容器仓库（Docker Hub 或云厂商专属仓库）：

```bash
docker tag mcp-server:1.0.0 <your-registry>/mcp-server:1.0.0
docker push <your-registry>/mcp-server:1.0.0
```

> 课里只讲了「推送到容器仓库」这个动作和 Docker Hub 这个例子，没有给具体 `docker tag` / `docker push` 命令；上面两条是标准 Docker 命令，按需替换 `<your-registry>`。

### 步骤 5：部署到云平台

讲师列举的云选项：**AWS、Microsoft Azure、Google Cloud Platform、Digital Ocean、Railway、Render**（p018 [07:40]）。流程统一为：镜像 → 仓库 → 云平台托管运行 → 监控。具体某家云的控制台操作课里没讲，需按各家文档操作。

### 步骤 6：配 CI/CD 流水线

讲师给的流水线顺序（p018 [09:33]）：**提交代码 → 跑自动化测试 → 构建 Docker 镜像 → 部署到目标环境 → 监控验证**。讲师列举的平台：**GitHub Actions、GitLab CI、Jenkins、CircleCI、Azure DevOps**。第 4 节给一份 GitHub Actions 的完整 workflow 作为可落盘示例（课里没给 YAML，此为按讲师描述的五个阶段整理的示意）。

### 步骤 7：配监控、健康检查、日志

讲师要求跟踪的指标（p018 [13:22]）：**CPU 利用率、内存消耗、响应时间、错误率、活跃连接数**。工具：**Grafana（仪表盘）、Prometheus（指标采集）、Datadog / New Relic（综合监控告警）**。健康检查在 Compose 里用 `healthcheck` 实现（第 4 节给出）。

### 步骤 8：版本化

语义化版本 `1.4.2`：主版本=破坏性变更，次版本=兼容的新功能，修订=缺陷修复。版本化范围：**Docker 镜像、API 契约、MCP 工具、数据库 schema、配置文件**（p018 [11:28]）。

---

## 4. 完整代码

> 以下文件均为**按讲师口述整理的可直接落盘版本**。课里没有在屏幕上展示代码，OCR 也无结果，因此凡讲师未明确给出的字段（如具体端口、环境变量名）均标注「课里没讲，按需调整」。

### 4.1 Dockerfile（对应 p018 [03:22] 讲师口述的五步结构）

```dockerfile
# Dockerfile —— 按讲师口述结构整理：Python 3.12 基础镜像 → 复制应用 → 工作目录 → 安装依赖 → 启动命令
FROM python:3.12-slim

# 定义工作目录（讲师口述「define the working directory」）
WORKDIR /app

# 先复制依赖清单并安装，利用 Docker 层缓存
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY . .

# 指定启动 MCP server 的命令（讲师口述「specify the command used to launch the MCP server」）
CMD ["python", "server.py"]
```

> 讲师强调「最小化镜像大小、减少层数、组织依赖能显著改善构建时间和性能」（p018 [04:47]）。上面把 `COPY requirements.txt` 与 `RUN pip install` 放在 `COPY . .` 之前，就是利用层缓存的常见做法。

### 4.2 docker-compose.yml（对应 p018 [05:45]：MCP server + PostgreSQL + Redis）

```yaml
# docker-compose.yml —— 按讲师口述的栈整理：MCP server + PostgreSQL + Redis + 支撑服务
services:
  mcp-server:
    build: .
    image: mcp-server:1.0.0
    ports:
      - "8000:8000"          # 课里没讲具体端口，按需调整
    environment:
      # 配置外部化：从环境注入，不硬编码（对应 p017「Externalize everything」）
      DATABASE_URL: postgresql://mcp:mcp@postgres:5432/mcpdb
      REDIS_URL: redis://redis:6379/0
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"]
      interval: 30s
      timeout: 5s
      retries: 3
    restart: unless-stopped

  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: mcp
      POSTGRES_PASSWORD: mcp
      POSTGRES_DB: mcpdb
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U mcp -d mcpdb"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7
    volumes:
      - redisdata:/data

volumes:
  pgdata:
  redisdata:
```

> 说明：`healthcheck`、`depends_on.condition`、`restart` 这些字段课里没讲，是按「健康检查」「高可用」要求补的常用配置；`/health` 端点需你在 server 里实现（课里没讲具体实现）。PostgreSQL / Redis 的版本号课里没讲，按当前稳定版填。

### 4.3 GitHub Actions CI/CD（对应 p018 [09:33] 五阶段流水线）

```yaml
# .github/workflows/deploy.yml —— 按讲师描述的「提交→测试→构建镜像→部署→监控验证」整理
name: build-and-deploy

on:
  push:
    branches: [main]

jobs:
  build-test-deploy:
    runs-on: ubuntu-latest
    steps:
      - name: 检出代码
        uses: actions/checkout@v4

      - name: 安装 Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: 安装依赖并跑测试
        run: |
          pip install -r requirements.txt
          pip install pytest
          pytest -q

      - name: 构建 Docker 镜像
        run: docker build -t mcp-server:${{ github.sha }} .

      - name: 登录容器仓库
        run: echo "${{ secrets.REGISTRY_PASSWORD }}" | docker login -u "${{ secrets.REGISTRY_USER }}" --password-stdin

      - name: 推送镜像
        run: |
          docker tag mcp-server:${{ github.sha }} ${{ secrets.REGISTRY }}/mcp-server:${{ github.sha }}
          docker push ${{ secrets.REGISTRY }}/mcp-server:${{ github.sha }}

      - name: 部署到目标环境
        run: echo "在此调用云平台部署命令（课里没讲具体命令）"

      - name: 监控验证
        run: echo "在此调用健康检查/监控接口（课里没讲具体实现）"
```

> 说明：`secrets.REGISTRY_*` 是 GitHub Actions 的密钥引用，课里没讲具体名字，按需在仓库 Settings 里配置。最后两步是占位，因为课里没讲具体云平台的部署命令。

### 4.4 环境变量清单（配置外部化，对应 p017 [09:27]）

```bash
# .env.example —— 配置外部化示例，真实值不进仓库
DATABASE_URL=postgresql://mcp:mcp@postgres:5432/mcpdb
REDIS_URL=redis://redis:6379/0
# 敏感信息用密钥管理服务，不写进 .env（对应 p017 [09:56]）
# AWS_SECRET_NAME=mcp/prod/credentials
```

> 讲师明确：**敏感信息绝不应存储在仓库中**，用 AWS Secrets Manager、HashiCorp Vault 或云原生密钥管理服务（p017 [09:56]）。`.env` 只放非敏感配置，且要加进 `.gitignore`。

---

## 5. 逐行解释

### Dockerfile

- `FROM python:3.12-slim`：讲师口述「从一个 Python 3.12 基础镜像开始」（p018 [03:22]）。`-slim` 变体体积小，符合讲师「最小化镜像大小」的建议（p018 [04:47]）。
- `WORKDIR /app`：对应「定义工作目录」。后续 `COPY` 和 `RUN` 都相对此目录，避免文件散落。
- `COPY requirements.txt .` + `RUN pip install`：先装依赖再复制代码，利用 Docker 层缓存——代码改动不会触发依赖重装。讲师强调「组织依赖能改善构建时间」（p018 [04:47]）。
- `COPY . .`：把应用代码复制进容器。
- `CMD ["python", "server.py"]`：对应「指定启动 MCP server 的命令」。用 exec 形式（JSON 数组）而非 shell 形式，信号能正确传给进程——这是容器优雅停机的关键，课里没展开但属生产必备。

### docker-compose.yml

- `services:` 下三个服务：`mcp-server`、`postgres`、`redis`，对应讲师说的「MCP server、PostgreSQL、Redis 以及额外支撑服务」（p018 [05:45]）。
- `build: .` + `image: mcp-server:1.0.0`：本地构建并打标签，标签用语义化版本（p018 [11:28]）。
- `environment` 注入 `DATABASE_URL` / `REDIS_URL`：这是「配置外部化、运行时注入」的直接落地（p017 [09:27]）。**在 JS/Node 里对应 `process.env.DATABASE_URL`**，Python 里对应 `os.environ["DATABASE_URL"]`。
- `depends_on.condition: service_healthy`：等 PostgreSQL 健康后再启动 MCP server，避免启动竞态。课里没讲这个字段，属生产常见做法。
- `healthcheck`：对应讲师要求的「健康检查应被实现，以自动检测并从故障中恢复」（p018 [15:44]）。
- `restart: unless-stopped`：对应「高可用、无单点故障」（p017 [11:49]）。
- `volumes`：PostgreSQL 和 Redis 数据持久化，对应「灾难恢复」（p017 [11:49]）。

### CI/CD workflow

- 五个 step 严格对应讲师给的流水线顺序：检出（提交代码）→ 测试 → 构建镜像 → 推送/部署 → 监控验证（p018 [09:33]）。
- `${{ github.sha }}` 作为镜像标签：每次提交唯一标签，天然支持回滚——对应讲师说的「版本化让安全回滚成为可能」（p018 [12:24]）。
- 密钥用 `secrets.*`：对应「敏感信息用专用密钥管理方案」（p018 [15:44]）。

### 架构决策（P17 部分，逐条解释为什么这样定）

- **一个 server 一个领域**：讲师举例 HR server 管员工记录/入职流程/组织架构，finance server 管发票/预算/财报，engineering server 管仓库/CI-CD/事故管理，analytics server 暴露仪表盘和 BI 工具，CRM server 管客户关系和销售管道（p017 [03:22]–[04:18]）。不这样做的后果：10 个部门各自造轮子，出现工具重复、配置蔓延、安全不一致（p017 [02:25]）。
- **客户数据 server 不放财务工具**：讲师原话「混合业务关注点会造成归属混乱、增加依赖、引入安全风险」（p017 [05:16]）。这是服务边界的红线。
- **共享库**：认证、日志、数据库访问（连接池/ORM/查询工具）、错误处理、配置管理五类应打包复用（p017 [07:08]–[08:05]）。不这样做就是每个项目重写一遍认证逻辑。
- **配置外部化**：API key、数据库连接、feature flag、环境变量、安全设置都不能硬编码（p017 [09:27]）。**在 JS/Node 里对应 `.env` + `dotenv`，在容器里对应 `environment` 注入**。
- **纵向 vs 横向扩容**：纵向加 CPU/内存/存储，简单但有硬件天花板；横向加实例 + 负载均衡，容错且能自动扩缩。企业压倒性偏好横向（p017 [14:39]）。**在 Node 里对应「多开几个进程 + 前面挂负载均衡」，而不是给单进程加内存**。
- **监控五指标**：工具使用量、响应延迟、错误率、资源消耗、活跃连接数（p017 [12:47]）。P18 补充 CPU、内存、响应时间、错误率、活跃连接（p018 [13:22]）。两讲指标有重叠，合并去重即可。
- **参考架构五原则**：模块化设计、共享库、集中式监控、自动化部署、横向可扩展（p017 [16:36]）。

---

## 6. 复现检查清单

按顺序打勾，每项都能独立验证：

- [ ] 本地 `python server.py` 能启动 MCP server（步骤 0）
- [ ] `docker build -t mcp-server .` 构建成功，无报错
- [ ] `docker run --rm -it mcp-server` 行为与本地一致（p018 [18:30]「验证行为完全符合预期」）
- [ ] `docker compose up` 一条命令拉起 mcp-server + postgres + redis 三个容器（p018 [06:12]）
- [ ] `docker compose ps` 显示 postgres 为 healthy，mcp-server 能连上数据库和 Redis
- [ ] 镜像打上语义化版本标签（如 `1.0.0`），`docker tag` + `docker push` 到仓库成功
- [ ] 云平台（AWS/Azure/GCP/DigitalOcean/Railway/Render 任选）能从仓库拉镜像并运行
- [ ] CI/CD 流水线在 push 后自动跑通「测试→构建→推送→部署→验证」五步
- [ ] 监控能看到 CPU、内存、响应时间、错误率、活跃连接数五项指标
- [ ] 健康检查端点返回 200，容器异常时能自动重启
- [ ] 敏感配置（数据库密码、API key）不在仓库里，来自密钥管理服务
- [ ] 能回滚到上一个镜像版本（用旧 tag 重新部署）

---

## 7. 课里没讲但你会撞上的

1. **MCP server 的传输方式与端口**：课里没讲 MCP server 在容器里用 stdio 还是 HTTP/SSE 传输，也没讲监听哪个端口。Compose 里的 `8000:8000` 和 `/health` 端点是本文档补的，你需要按实际传输方式调整——stdio 传输的 server 在容器里通常由客户端通过 `docker exec` 或 sidecar 调用，不暴露端口。
2. **健康检查端点怎么实现**：课里要求「实现健康检查」（p018 [15:44]），但没给代码。Python 里可用 FastAPI/Flask 加一个 `/health` 路由；Node 里对应 `app.get('/health', ...)`。
3. **数据库 schema 迁移**：讲师说「数据库 schema 要版本化」（p018 [11:28]），但没讲用什么迁移工具（Alembic、Flyway 等）。这是你上生产前必须补的一环。
4. **密钥管理服务的具体接入**：讲师点名 AWS Secrets Manager、HashiCorp Vault，但没给 SDK 调用代码。你需要按所选云厂商的 SDK 在启动时拉取密钥注入环境变量。
5. **Kubernetes 具体配置**：P17 提到 Kubernetes 提供编排、自动扩缩、高可用（p017 [10:52]），但两讲都没给 Deployment/Service/HPA 的 YAML。如果规模到了 K8s，这部分要另学。
6. **负载均衡的具体选型**：P17 说横向扩容「用负载均衡分发流量」（p017 [15:08]），但没讲用 Nginx、HAProxy 还是云厂商 LB。
7. **日志聚合方案**：讲师说「集中式日志平台」（p017 [13:44]）和「审查日志识别异常行为」（p018 [13:50]），但没点名具体工具（ELK、Loki 等都没提）。
8. **零停机部署的具体机制**：讲师要求「尽可能零停机部署」（p017 [11:49]），但没讲蓝绿部署、滚动更新、金丝雀发布的具体做法。
9. **成本估算**：讲师说部署策略要「平衡成本、复杂度和性能」（p017 [12:19]），但没给任何数字。云上跑 PostgreSQL + Redis + 容器，成本因厂商和规格差异很大，需自行询价。
10. **演示环节的实际操作**：P18 最后一段（[18:30] 起）是演示的**预告**，讲师描述了完整生命周期，但逐字稿到 [20:31] 就结束了，**实际演示的命令行操作没有出现在本段逐字稿里**。如果你要跟着敲，以本文档第 3、4 节为准。

---

### 附：本段课程截图索引（按出现顺序，供对照）

![p017 00:36 讲师列出企业级 MCP 平台的四大特征](images/p017_0036s.jpg)
![p017 01:49 从单个 MCP server 演进到企业平台](images/p017_0109s.jpg)
![p017 03:02 多部门各自造轮子导致的重复与蔓延](images/p017_0182s.jpg)
![p017 04:15 按领域拆分 server 的模块化架构](images/p017_0255s.jpg)
![p017 05:28 服务边界划分的指导原则](images/p017_0328s.jpg)
![p017 06:40 共享库作为企业架构的积木](images/p017_0400s.jpg)
![p017 07:53 配置外部化与密钥管理](images/p017_0473s.jpg)
![p017 09:06 部署选项对比：本地/VM/容器/K8s/云](images/p017_0546s.jpg)
![p017 10:19 监控五大指标](images/p017_0619s.jpg)
![p017 11:32 纵向扩容 vs 横向扩容](images/p017_0692s.jpg)
![p017 12:44 企业 MCP 参考架构图](images/p017_0764s.jpg)
![p017 13:57 参考架构五原则总结](images/p017_0837s.jpg)
![p018 00:41 生产部署的六大共同目标](images/p018_0041s.jpg)
![p018 02:03 Docker 解决「在我机器上能跑」](images/p018_0123s.jpg)
![p018 03:26 Dockerfile 五步结构](images/p018_0206s.jpg)
![p018 04:48 docker build 生成可复用镜像](images/p018_0288s.jpg)
![p018 06:10 Docker Compose 单文件定义整个栈](images/p018_0370s.jpg)
![p018 07:32 云平台部署工作流](images/p018_0452s.jpg)
![p018 08:54 CI/CD 五阶段流水线](images/p018_0534s.jpg)
![p018 10:17 语义化版本 1.4.2 三段含义](images/p018_0617s.jpg)
![p018 11:39 版本化范围：镜像/API/工具/schema/配置](images/p018_0699s.jpg)
![p018 13:01 监控指标与维护活动](images/p018_0781s.jpg)
![p018 14:23 生产部署最佳实践](images/p018_0863s.jpg)
![p018 15:45 生产系统五特征：可靠/安全/可观测/可扩展/可恢复](images/p018_0945s.jpg)