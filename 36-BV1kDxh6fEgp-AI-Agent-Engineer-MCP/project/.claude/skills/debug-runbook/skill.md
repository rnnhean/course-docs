---
name: debug-runbook
description: Debug TicketBay when something breaks. Use when the user says
  "something is broken", "debug", "why is this failing", "the page won't load",
  "sold-out show says few left", or "investigate this bug". Reads logs first,
  runs the repro script, never mutates the database.
---

# Debug Runbook

> 课程 P14 的示范技能。核心不是内容多全，而是 **description 里的触发词决定它会不会被加载**：
> "The description decides when the skill triggers... the vague description makes the skill invisible." —— p014 [01:20]

## When to use
Trigger on the phrases above. Do not use for feature work or refactors.

## First steps (order matters)
1. Read the app log at `logs/app.log` first — not the test log.
2. Run `scripts/repro.sh` to reproduce the reported symptom.
3. Check `git log --oneline -10` for recent changes touching the failing area.

## Gotchas (highest-signal section — append every time the agent gets it wrong)
- Never force-push to the production branch.
- The staging API only works over the VPN.
- Clear the build cache after any env-id change.
- Never change data in the database during debugging.
- 座位数为 0 时徽章必须显示 sold out：判断是 `<= 0`，不是 `< 0`（p044 埋的那个 bug）。

## Scripts (deterministic steps — same result every run)
- `scripts/repro.sh` — reproduces the bug
- `scripts/read-order.sh <id>` — reads one order from the DB

> 判据来自课程：**每次结果必须一样的步骤写成脚本，需要判断的留给指令。**
> "If every run must give the same result, make it a script... Deciding where to look first, and whether it is a bug or a policy. Those stay as instructions." —— p014 [03:36]
