# Q&A

> 学习过程中的提问与回答，按时间追加。
>
> 两类条目：
> - **讲课补充**——我在讲解时主动展开、但课程没有单列一页的点
> - **提问**——你实际问的，按原话记录，回答保留推理过程
>
> 每条都带课程出处。课程没讲的会明确写「课里没讲」。

---

## Q1. 为什么说 harness 比模型更重要？

> 讲课补充（第 1 讲）

因为同一个模型下，harness 的差距可以超过模型代差。

> "One team took the same model and changed only the harness. And that same model went from the top 30 to the top 5. Same model. Same tasks. The harness made the difference."
> —— p004 [00:27]

具体到工程上，harness 决定四件事：

1. **模型能看到什么**（context）
2. **模型能做什么**（tools）
3. **模型不能做什么**（hooks / boundary）
4. **模型什么时候被叫醒**（loop）

这四件事模型自己都决定不了。换模型只影响「同样输入下输出质量」，而 harness 影响的是「模型拿到什么输入、能不能动手、动手后有没有人检查」。

对你的岗位来说还有一层：模型不是你的，harness 是你的。简历上能写、面试能讲深的，全在 harness。

---

## Q2. 上下文窗口里到底装了什么？

> 讲课补充（第 7 讲）

在你输入任何内容之前，窗口里已经有：

| 内容 | 说明 |
|---|---|
| harness 的 system prompt | 不可控，固定开销 |
| 每个内置工具的定义 | **工具越多，每次调用越贵** |
| `CLAUDE.md` / `agents.md` | 你自己写的 |
| 记忆文件 | 跨会话累积 |
| 每个已安装 skill 的 description | 只加载名字和描述，正文按需 |

这就是课程 P7 让你先跑 `/context` 的原因——**先看见预算，再谈优化**。

> "And when it fills up, the model gets worse. It forgets an instruction from an hour ago. It makes a mistake it didn't make at the start."
> —— p004 [01:25]

对应的四个操作（p007 [01:27]）：

- **Select**：只挑相关的进来
- **Compress**：进来之前先压缩（日志先 grep 再读）
- **Isolate**：隔离到另一个窗口（子代理读完只回摘要）
- **Offload**：卸载到文件，下次再读

本仓库的落地：`hooks/typecheck-one-file.mjs` 只回灌当前文件的错误（Compress）；`hooks/load-context.mjs` 只给摘要不给 diff 全文（Compress）。

---

## Q3. 为什么用容器限制，而不是在 prompt 里写「不要读密钥」？

> 讲课补充（第 11 讲）

因为 prompt 是文字，模型可以不听。

> "A rule in your agents.md is only text and nothing forces the model to follow it... A hook is a script the harness runs at a fixed moment."
> —— p017 [00:00]

容器给的是「不存在」，prompt 给的是「请不要」。

讲师演示 `ls ~/.ssh` 得到 "No such folder"——不是权限拒绝，是那个目录在容器里根本没被挂进来。模型再想读也读不到。

本仓库的落地：`box/Dockerfile` 只装 Node/Git/Claude Code，宿主机 home 目录从未挂载。

---

## Q4. hook 和 agents.md 里的规则有什么区别？

> 讲课补充（第 17 讲）

| | agents.md | hook |
|---|---|---|
| 形式 | 上下文里的一段文字 | harness 在固定时刻执行的脚本 |
| 模型能不能绕开 | 能（忘了、忽略了、被别的指令覆盖） | 不能 |
| 成本 | 每次调用都占 token | 只在触发时刻跑 |
| 适合什么 | 需要判断的规则（「金额用整数分存」） | 明确的动作（「写完必须跑测试」） |

判据在课程 P13 和 P17 各出现一次：

> "A line stays if the agent cannot find it out by itself and if it's true everywhere in the repo." —— p013 [00:58]
> "If every run must give the same result, make it a script." —— p014 [03:36]

本仓库的落地：

- **阻断型**（模型过不去）：`block-dangerous` / `block-secrets` / `test-gate`
- **告知型**（模型能看到）：`typecheck-one-file` / `load-context`

课程还强调一条：阻断时必须告诉 Agent 该做什么。

> "So when you block something, always tell the agent what to do instead." —— p017 [01:21]

只拦不指路，模型会在同一个地方反复撞墙。

---

## Q5. 课程为什么反复强调「测试会骗人」？

> 讲课补充（第 19 讲）

三种骗法，课程 P19 逐个点名：

| 骗法 | 现象 | 对策 |
|---|---|---|
| 测试没检查行为 | 覆盖率 100%，但没有任何断言 | 变异测试 |
| 缺边界用例 | 正常路径都过，边界全崩 | 属性测试 |
| 单元测试全绿但页面是坏的 | 集成层断裂 | E2E |

> "Coverage counts the lines a test runs, not whether the test checks anything... You can have 100% coverage without any test assertions."
> —— p020 [00:00]

> "The mutation score is the killed mutants divided by all the mutants."
> —— p020 [03:14]

为什么这门课要把测试放这么重：**因为代码是 agent 写的，你没有逐行读的预算**。测试是唯一能自动化判断「agent 的产出对不对」的东西。测试不可信，整条自动化链路就不可信。

---

## 待提问

（你接下来的问题追加在这里，格式：原话 → 回答 → 课程出处）
