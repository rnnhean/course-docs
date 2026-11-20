# Agent Harness

按课程 **AI Agent Engineer**（B 站 `BV1kDxh6fEgp`，55P）落地的工程项目：**box 边界、skill、hook、MCP server、测试门**。

> **课程源码**：课程自带的 TicketBay 仓库在 `https://github.com/dmoka/ticket-bay`（P2 提到、课程官网给了链接）。
> 本目录是在它之外自建的实现：hook / skill / box / MCP server 按课程讲的做，业务层用课程里出现过的实体做最小重建。

## 出处

- 课程：AI Agent Engineer（MCP + 注入防御 + 质量门），B 站 `BV1kDxh6fEgp`，55P，3.6 小时
- 课程文档：同级目录 `../`（本仓库按每门课一个目录组织）
  - `../BV1kDxh6fEgp-p1-13.doc.md` 环境 / box / context / agents.md
  - `../BV1kDxh6fEgp-p14-21.doc.md` skill / MCP / subagent / hook / 测试三件套
  - `../BV1kDxh6fEgp-p22-31.doc.md` E2E / CI lane / 意图先行工作流
  - `../BV1kDxh6fEgp-p32-44.doc.md` Brain / MCP server / loop / 注入防御
  - `../BV1kDxh6fEgp-p45-55.doc.md` AI 员工

## 课程的核心命题

> "Agent equals model plus harness. And typically, it runs tools in a loop to achieve a goal."
> —— p004 [02:20]

同一个模型，只改 harness，Terminal-Bench 从第 30 名到第 5 名（p004 [00:27]）。harness 不是胶水，是决定能力上限的那一层。

## 目录

```
.
├── box/                      # 边界盒子：Dockerfile / devcontainer / 防火墙 / 启动脚本（P11）
├── .claude/
│   ├── settings.json         # hook 挂载（P17）
│   └── skills/
│       └── debug-runbook/    # 技能：按需加载的操作流程（P14）
├── hooks/                    # 五个钩子：三个阻断、两个告知（P17）
├── .mcp.json                 # 项目级 MCP 服务器（P15）
├── mcp-server/               # 三工具只读 server → HTTP + 鉴权（P32–P44）
├── app/                      # TicketBay 的最小重建（课程未公开源码）
└── docs/
    └── course-notes.md       # 课程讲了什么 + 课程原话 + 我的重建差异
```

## 怎么跑

```bash
# 1) 装依赖
npm install

# 2) 起最小 TicketBay
npm run dev

# 3) 把本地 MCP server 注册进 Claude Code
claude mcp add ticketbay -- node mcp-server/stdio.mjs

# 4) 进边界盒子（需要 Docker）
./box/box bash

# 5) 跑测试
npm test
```

## 验收

- [ ] `./box/box bash` 进去后：`whoami` 是 `node`、`~/.ssh` 不存在、`example.com` 被阻断、npm 与 GitHub 可达
- [ ] 三个 hook 阻断危险命令 / 读 `.env` / 测试未过时的完成声明
- [ ] `list_events` / `get_event` / `quote_price` 三个只读工具能回答「未来三周内、50 欧以下的音乐会」
- [ ] HTTP 版：无 key 只有公开工具，错 key 返回 401，`my_orders` 需要 read 权限
- [ ] 变异分数覆盖改动代码；属性测试「任何请求都不返回 500 且永远是 JSON」
