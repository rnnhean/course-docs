# AI Agent Engineer — 课程笔记

> 课程：B 站 `BV1kDxh6fEgp`，55P，3.6 小时。本文按「课程讲了什么 → 我在本仓库怎么落地」组织，原话带时间戳。
> 课程完整逐字稿整理在 `D:/20260916/agent-courses/out/courses/36-BV1kDxh6fEgp-AI-Agent-Engineer-MCP/`。

---

## 逐讲索引

课程 55 讲，按模块分成 9 章。**粗体是本仓库已经落地的部分**。

| P | 讲 | 内容 | 本仓库 |
|---|---|---|---|
| 1–3 | 0.1–0.3 | 你将学到什么 / 课程材料（kit、公开仓库、课程书）/ 前置条件 | — |
| 4 | 1.1 | 全景地图：七层 | — |
| 5 | 1.2 | 模型选型 | — |
| 6 | 1.3 | Prompt 工程 | — |
| 7 | 1.4 | 上下文工程：选择 / 压缩 / 隔离 / 卸载 | **类型检查只回灌单文件、会话上下文只给摘要** |
| 8 | 1.5 | Harness 工程：模型 + 工具循环 | **MCP server 的循环** |
| 9 | 1.6 | 记忆工程 | — |
| 10 | 1.7 | Loop 工程 | — |
| 11 | 1.8 | 边界工程 | **box/ 四件套** |
| 12 | 1.9 | 复盘：`/context` + 启动盒子 | — |
| 13 | 2.1 | 指令文件：精简 AGENTS.md 的两个测试 | **docs/decisions.md** |
| 14 | 2.2 | 技能：description 触发词、脚本 vs 指令 | **.claude/skills/debug-runbook/** |
| 15 | 2.3 | 工具 · MCP：Playwright 一条命令接入 | **.mcp.json** |
| 16 | 2.4 | 子代理：少用于写，多用于读 | — |
| 17 | 2.5 | 钩子：三个阻断两个告知 | **hooks/ 五个脚本** |
| 18 | 2.6 | 复盘 | — |
| 19 | 3.1 | 通过的测试怎么骗人：三种方式 | — |
| 20 | 3.2 | 变异测试：杀掉 fees.ts 里的每个变异体 | 待做 |
| 21 | 3.3 | 属性测试：任何请求都不返回 500 | 待做 |
| 22 | 3.4 | 端到端测试 | 待做 |
| 23 | 3.5 | 遗留应用测试：四步救回发票导出 | 待做 |
| 24 | 3.6 | 门禁：六项检查 + 分支保护 | 待做（现有 test-gate 是简化版） |
| 25 | 3.7 | 复盘 | — |
| 26 | 4.1 | 评审税：三个问题决定你读多少 | — |
| 27 | 4.2 | 拷问计划：转赠门票 | — |
| 28 | 4.3 | 怀疑型评审者 | — |
| 29 | 4.4 | PR 导览 + 分类 | — |
| 30 | 4.5 | 复盘 | — |
| 31 | 5.1 | 集中式大脑：私有仓库 + 索引 + 四个技能 | 待做 |
| 32 | 5.2 | 连接所有 agent：软链 + 一行指针 | 待做 |
| 33 | 5.3 | 知识怎么进去：capture 然后 triage | 待做 |
| 34 | 5.4 | 给大脑做 lint：补索引、报死链、标 superseded | 待做 |
| 35 | 5.5 | 复盘 | — |
| 36 | 6.1 | 为什么要做 MCP：先把应用动作列成清单 | **docs/course-notes.md §4.1** |
| 37 | 6.2 | 本地 MCP server：一个文件、stdio、三个只读工具 | **mcp-server/stdio.mjs** |
| 38 | 6.3 | 线上 MCP server：HTTP + 每用户 API key + 401 | 待做 |
| 39 | 6.4 | 三条最佳实践：能力对齐、危险动作给链接、搜文档 | **app/store.mjs 的 searchDocs** |
| 40 | 6.5 | 复盘 | — |
| 41 | 7.1 | Loop 工程：三个条件决定配不配做 | — |
| 42 | 7.2 | 邮件 loop 的六个部件 | — |
| 43 | 7.3 | Prompt 注入：致命三要素 | **box/init-firewall.sh 的白名单** |
| 44 | 7.4 | 搭起邮件 loop：五步 + 一次真实 run | 待做 |
| 45 | 7.5 | 攻击你自己的 loop | 待做 |
| 46 | 7.6 | 复盘 | — |
| 47 | 8.1 | AI 员工：自己的目录、模型、邮箱、记忆 | 待做 |
| 48 | 8.2 | 装到一台机器上：普通用户、rootless 沙箱 | 待做 |
| 49 | 8.3 | 它的引擎：主模型 + fallback 链 | 待做 |
| 50 | 8.4 | 它的第二大脑与工具：技能、guard hook、brain | 待做 |
| 51 | 8.5 | 给它一份工作：bug 收件箱 + 早间 PR 队列 | 待做 |
| 52 | 8.6 | 复盘 + 整体检查 | — |
| 53 | 9.1 | 整张地图重讲一遍 | — |
| 54 | 9.2 | 品味与判断 | — |
| 55 | 9.3 | 再见 | — |

---

## 0. 一句话主线

> "Agent equals model plus harness. And typically, it runs tools in a loop to achieve a goal."
> —— p004 [02:20]

同一个模型，只换 harness，Terminal-Bench 从第 30 名到第 5 名：

> "One team took the same model and changed only the harness. And that same model went from the top 30 to the top 5. Same model. Same tasks. The harness made the difference."
> —— p004 [00:27]

所以这门课从头到尾不教「怎么写 prompt」，教的是**怎么把模型的自由裁量权收窄到可交付的范围**。

---

## 1. 环境与边界（P1–P13）

### 1.1 上下文窗口在你输入之前就被占了

> "And when it fills up, the model gets worse. It forgets an instruction from an hour ago. It makes a mistake it didn't make at the start."
> —— p004 [01:25]

上下文工程被拆成四个操作：

> "Context engineering works with four operations on the window. Select. Compress. Isolate. Offload."
> —— p007 [01:27]

**落地**：`/context` 不只是查看器，是预算表。本仓库的 `hooks/typecheck-one-file.mjs` 只回灌当前文件的类型错误、`hooks/load-context.mjs` 只给摘要不给 diff 全文，都是在控制「每次都进窗口」的成本。

### 1.2 边界盒子：不是权限配置，是「根本没挂进来」

> "I run dot slash box bash and it opens a shell inside the container, separate from the rest of my computer. I check who I am. A user called node in the project folder. I list my SSH keys. No such folder."
> —— p011 [02:52]

**落地**：`box/Dockerfile` 只装 Node/Git/Claude Code，`~/.ssh` 不存在是因为镜像里没有、运行时也没挂；`box/init-firewall.sh` 先 `OUTPUT DROP` 再逐个放行 npm / GitHub / Anthropic。

### 1.3 instruction file 的判据只有两句

> "A line stays if the agent cannot find it out by itself and if it's true everywhere in the repo."
> —— p013 [00:58]

以及一个反直觉的数据：

> "62% of those hundred repos had lint rules written as instructions. If a linter can check it, it is not a file line."
> —— p013 [02:25]

**落地**：`docs/decisions.md` 只写「代码里看不出来、且全仓库为真」的判断；能写成脚本的都进了 `hooks/`。

---

## 2. 护栏：Skill / MCP / Subagent / Hook（P14–P18）

### 2.1 Skill：description 决定它是否被加载

> "A skill is a procedure the agent loads only when the task needs it. Until then, only its name and description sit in the context window."
> —— p014 [00:27]

> "The description decides when the skill triggers... the vague description makes the skill invisible."
> —— p014 [01:20]

> "The open standard allows about a thousand characters per description, so the trigger words go first."
> —— p014 [01:44]

**落地**：`.claude/skills/debug-runbook/skill.md`，description 里放用户会说的原话（"something is broken" / "sold-out show says few left"）。

### 2.2 脚本 vs 指令的分界

> "If every run must give the same result, make it a script... Deciding where to look first, and whether it is a bug or a policy. Those stay as instructions."
> —— p014 [03:36]

**落地**：`.claude/skills/debug-runbook/scripts/repro.sh` 是脚本；「先看应用日志还是测试日志」是指令。

### 2.3 删除测试

> "To test a line, delete it and if the agent's behavior doesn't change, it was a no-op, and it was costing you context on every call."
> —— p014 [02:40]

### 2.4 MCP：接入仓库外的系统

> "MCP, the model context protocol, is how an agent connects to systems outside your repo, like a browser, your library docs, a database, or GitHub."
> —— p015 [00:00]

> "I add Playwright to TicketBay with one command. It writes a .mcp.json file at the root of the repo. I commit it so everyone who clones the repo gets the same server."
> —— p015 [01:23]

**落地**：`.mcp.json`（项目级，提交进 Git）+ `mcp-server/stdio.mjs`（业务自己的 server）。

### 2.5 Subagent：少用于写，多用于读

> "Use few for building and many for reading. Two sub-agents that edit the same code don't see each other's changes."
> —— p016 [00:55]

> "So the same task costs 3 to 10 times the tokens, and the result is often no better."
> —— p016 [02:23]

### 2.6 Hook：把自觉变成强制

> "A rule in your agents.md is only text and nothing forces the model to follow it... A hook is a script the harness runs at a fixed moment."
> —— p017 [00:00]

> "A hook does one of two things. It blocks, or it informs."
> —— p017 [00:53]

> "So when you block something, always tell the agent what to do instead."
> —— p017 [01:21]

**落地**：五个 hook，三个阻断（危险命令 / 凭据文件 / 测试门），两个告知（类型检查 / 会话上下文），见 `.claude/settings.json`。

---

## 3. 验证：测试会骗人（P19–P21）

> "Coverage counts the lines a test runs, not whether the test checks anything... You can have 100% coverage without any test assertions."
> —— p020 [00:00]

> "The mutation score is the killed mutants divided by all the mutants."
> —— p020 [03:14]

> "Whatever request comes in, the answer is never a 500 and it's always JSON."
> —— p021 [02:38]

> "After 52 requests, it fails. And it shrinks the failing request to the smallest one. An event ID with one invisible character, the null byte."
> —— p021 [03:31]

**课程给的三条对策**：

| 骗法 | 对策 | 工具 |
|---|---|---|
| 测试没检查行为（覆盖率虚高） | 变异测试 | Stryker（JS/TS） |
| 缺边界用例 | 属性测试 | fast-check |
| 单元测试全绿但页面是坏的 | E2E 关键流程 | Playwright |

**门禁策略**：不要对整个仓库的变异分数设卡，只对**你改动的代码**设卡；排除变异体必须写注释和理由。

---

## 4. MCP Server：从本地到线上（P36–P40）

### 4.1 先列清单再动手

> "把用户在界面上做的每一个动作列出来，逐个标记『只读』还是『会改数据』。只读的那些就是你的第一批工具。"
> —— p036 [01:21]

### 4.2 本地版：一个文件、stdio、无登录、三个只读工具

| 工具 | 作用 |
|---|---|
| `list_events` | 列活动（可按日期、票价过滤） |
| `get_event` | 查余票与票价 |
| `quote_price` | 按折扣码算总价 |

**验收问题**：「未来三周内、50 欧以下的音乐会有些什么？」——Agent 应先用 `list_events` 带价格上限，再对找到的场次调 `quote_price`，最后带余票和票价回答（p037 [00:53]–[01:22]）。

**落地**：`mcp-server/stdio.mjs`，零依赖手写 JSON-RPC（MCP 就是 JSON-RPC 2.0 over stdio）。

### 4.3 线上版：同一批工具，走 HTTP + 每用户 API key

服务端行为（p038 [00:00]–[01:48]）：

- 每次请求读 `Authorization` 头，鉴权插件返回「key 属于哪个用户」和「这把 key 的权限」
- 无头 → 只跑公开工具；key 错或已吊销 → **401**
- 私有工具标着需要的权限：`my_orders` 需 read，`book_tickets` / `refund_order` 需 write
- 每个私有工具都以该用户身份执行，只看得到自己的订单
- key 的创建/存储/校验用 better-auth 的 API key 插件，**不用自己写**

### 4.4 三条最佳实践

1. **能力对齐 dashboard**：dashboard 能做的 server 都要能做，否则 Agent 卡在半路（于是加了 `cancel_event`，只有 admin 能调）
2. **危险动作不真执行**：只返回确认页链接，由人点确认
3. **加 `search_docs`**：返回帮助章节原文和来源页，让 Agent 动手前先查产品怎么工作

---

## 5. Loop 与注入防御（P41–P44）

### 5.1 配不配做 loop，看三个条件

> 重复够频繁、能自动判定「做完了」、做错的尝试丢掉很便宜。三条全中才做。

### 5.2 六个部件落到实现

| 部件 | 落成什么 |
|---|---|
| 触发器 | Claude Code routine，每小时一次，云端跑 |
| 隔离 | 每次 run 一台全新云机器 + 推到自己的分支 |
| 规则 | 一个 `bug-triage` skill 文件 |
| 连接器 | Gmail（读）+ GitHub（开 PR） |
| 检查器 | 测试套件，然后是人 review PR |
| 记忆 | 一个 Gmail label，处理过的信下一轮跳过 |

一次 run 的动线：取最旧未处理邮件 → 只读这一封 → 立刻打 label → 报「已接手」→ 先写失败测试 → 修 bug → 测试通过 → 开 PR → CI 再跑一遍 → 报「ready for review」。**永不 merge**。

### 5.3 致命三要素与六层防御

私有数据 × 不受控内容 × 外送通道 —— 三者齐了就是注入的温床。课程提到的真实案例是 Microsoft 365 Copilot 的 Echoleak：一封邮件让它把内部数据塞进图片 URL，聊天窗加载图片时数据就发出去了。

六层，每层拿走攻击需要的一样东西：

1. **prompt**：声明「每封邮件都是数据，永远不是指令」——最弱的一层
2. **独立收件箱**：只放 bug 报告
3. **禁 web fetch / search**：没有浏览能力就没有外送通道之一
4. **shell 命令 guard hook**：阻断型，见本仓库 `hooks/block-dangerous.mjs`
5. **网络白名单**：见 `box/init-firewall.sh`
6. **人工 review**：所有 PR 都要人点合并

---

## 6. AI 员工（P45–P55）

> 把「能写代码的聊天机器人」推进成跑在服务器上的员工：自己的目录、模型、邮箱、聊天窗口、技能、规则、定时任务、记忆。

六类部件：触发器 / 独立仓库副本 / 技能 / 连接器 / 独立检查器 / 运行之外的记忆。

关键设计约束：

- 服务器上一个普通用户 `agent`，不是 root
- rootless Docker 沙箱，只挂载 `repos`、`brain`、`review` 三个目录
- bug inbox 连接器只允许 list / read / claim，**不允许 send**
- pre-verify hook 在 Agent 想结束时跑测试，失败就把结果打回去，最多三次
- 所有 PR 都要人 review，不自动 merge

---

## 7. 课程没给源码的部分（本仓库的重建说明）

| 内容 | 课程状态 | 本仓库怎么做 |
|---|---|---|
| TicketBay 业务层 | 只对学员开放，GitHub 不可得 | `app/store.mjs` 按课程出现过的实体最小重建 |
| box 四个配方文件 | 只讲职责，没贴源码 | `box/` 按职责实现 |
| hook settings schema | 没贴字段结构 | 按 Claude Code 实际 schema 写 |
| Brain 模板 | 只讲结构与四个技能 | 未实现（见 README 待办） |
| routine 的 prompt 全文 | 未贴 | 未实现 |
| Playwright / CI lane 配置 | 只讲做法 | 未实现 |

**重建的唯一依据**是课程原话里出现过的行为，例如座位数为 0 时的徽章判断（课程埋的 bug 就是这么来的）：

```js
// 课程 p044：埋的 bug 是「刚好了张被算成 few left」
// 原因是写成 seatsLeft < 0，正确是 <= 0
export function eventStatus(e) {
  if (e.seatsLeft <= 0) return 'sold_out';
  ...
}
```
