# AI Security Bootcamp part2：A/B 流量分割、路由锁定与 Gradio 客服机器人（P087–P088）

> 阅读对象：前端转 AI 应用工程师。本文按“照着做就能跑”的标准写，凡是逐字稿没讲、截图也没出现的参数，都会明确标注「课里没讲」。

---

## 1. 这一节做什么

这两集是同一个项目的两个连续阶段，最终产物是一个**带 A/B 测试、会话级模型锁定、用户反馈闭环的客服聊天机器人**。

- **P087（Module 4）**：讲 TensorZero Gateway 的 **A/B 测试与流量分割**。你要做出三样东西：
  1. 一个 `tensor0.toml`（讲师口头叫法，实际就是 TensorZero 的配置文件），里面定义两个 variant（OpenAI GPT-4 mini 与 Groq Llama），用 `weight` 字段做**静态 A/B**：先 0.5/0.5，再手动改成 0.8/0.2，观察流量怎么切。
  2. 一套**反馈闭环**：每次推理拿 `inference_id`，调用 `client.feedback` 打 `thumbs_up` / `thumbs_down`，数据落到本地 Postgres，再用 SQL 算出每个 variant 的「平均质量」。
  3. 把 `weight` 换成 `type = "adaptive"` 的**自适应 A/B**，由 TensorZero 根据 thumbs up 的多少自动调权重；同时演示 **episode / routing lock-in**：同一个会话里第一轮落到哪个模型，后面所有轮次都锁在同一个模型上，否则反馈数据会被“混模型”污染。
- **P088（Module 5）**：把上面这些能力组装成一个 **Gradio 客服机器人**，跑在本地 URL 上。用户在前端输入消息 → Gradio → TensorZero Gateway → OpenAI / Groq，页面上还能点「good response / bad response」把反馈写回 TensorZero，并能在 inferences / episodes 页面里逐条核对。

前置条件（讲师明确要求）：**先看完 Module 1–4**，因为这里会直接复用 system prompt、minijinja 模板、episode、provider routing、feedback API、observability 这些已经演示过的东西。讲师在 P088 开头说得很直白：这门课不是教新语法，是**把前面所有零件拼成一个能跑的项目**。

最终目录结构如下（P088 里讲师是在 Jupyter Notebook 里写的，同时又建议你“不要在 Gradio 里写，去 VS Code 做正规的模块化编码”，所以下面给的是模块化版本，Notebook 只作为实验脚本）：

```
ai-security-bootcamp/
├── config/
│   └── tensorzero.toml          # 讲师口中的 tensor0.toml
├── notebooks/
│   ├── 01_static_ab.ipynb       # 静态 A/B：0.5/0.5 → 0.8/0.2
│   ├── 02_routing_lock.ipynb    # episode 锁定实验
│   ├── 03_feedback_sql.ipynb    # 反馈回流 + SQL 统计
│   └── 04_adaptive_ab.ipynb     # 自适应 A/B
├── app/
│   └── gradio_app.py            # P088 的客服机器人
├── .env
└── requirements.txt
```

---

## 2. 讲师原话

> "现在开始模块 4。在模块 4 里，我们会讲 A/B 测试和流量分割。你也可以参考这些图片，但我会手动讲给你听。我想你已经熟悉 A/B 测试了，我在模块 1 里讲过，基本上你可以把总流量按 80-40%、80-20%、50-50% 这样切分，50% 的人去那边、50% 的人去那边。"
> —— p087 [00:00]

> "流量会按权重切分。这里你把 80% 流量送出去，所以 weight 等于 0.8，它去 OpenAI；20% 意味着 weight 等于 0.2，它去那个新的 XYZ 模型。然后你会跑反馈闭环，而这个反馈闭环只针对 TensorZero 这一个点。"
> —— p087 [02:19]

> "首先我会讲静态。静态就是手动方式，静态，或者我们可以叫手动。在静态里你定义权重。"
> —— p087 [04:47]

> "所以一段时间之后你可以这样做：更新你的 tensor0.toml 文件，把 OpenAI 改成 0.6、Groq 改成 0.4……然后你必须重启 gateway。"
> —— p087 [07:15]

> "自适应是怎么做的？你不需要定义权重。TensorZero 会自动给 OpenAI 分配 0.5 权重，自动给 Groq 分配 0.5，一开始它就只分配这个。"
> —— p087 [08:12]

> "在生产环境里你不会做手动的事情。而且这个权重的东西……在 TensorZero 库里，weight 字段正在被废弃，我想在接下来的 2027 年会废弃，他们只会依赖自适应部分。"
> —— p087 [09:35]

> "然后我们发 20 个请求。这个函数会自动 50/50 切分，因为你已经定义了 0.5 / 0.5。但要注意，因为数字很小，只有 20 个请求，一般来说这个权重只有在你拥有几千、几万个请求时才有效；在 20 这样的小数字下，它可能不会那么好，可能不是严格的 50/50 切分。"
> —— p087 [11:27]

> "还有一个东西，就是 consistent episodes，我们也叫 routing lock。这是个重要概念。"
> —— p087 [15:16]

> "所以基于整段对话，他会给反馈说我喜欢这段对话，或者我不喜欢。但这个反馈不可靠，因为一半问题由 GPT 回答、一半由 Groq 回答。"
> —— p087 [17:14]

> "为什么它对 A/B 测试质量很关键？否则你会得到很差的指标、非常不一致的数据，显然你也拿不到好的用户反馈，因为模型被混在一起了。"
> —— p087 [22:03]

> "现在如何发送反馈？你需要 client.feedback，传入 inference ID，指标是 thumbs up / thumbs down。"
> —— p087 [22:32]

> "所以基本上我们会做自动模型优化，也就是自适应 A/B 测试。显然需要一个新的 toml 文件，因为现在我们用的是 weight 参数，那个 weight 参数会被替换。"
> —— p087 [25:24]

> "functions.chat……function.chat.ab_experimentation，type 等于 adaptive，candidates 是候选……metric 会选 thumbs_up。"
> —— p087 [26:49]

> "但我们要基于正向投票：OpenAI 拿到多少正向投票、Groq 拿到多少正向投票。如果 OpenAI 的正向投票更好，它就会把 OpenAI 的权重调高。如果我们设成 thumbs_down，它就会检查负向投票。"
> —— p087 [27:18]

> "在第一轮是 50/50 切分；第二轮显然 GPT 拿到更高的百分比，所以它会切到 GPT；但第三轮它又切回去了。"
> —— p087 [29:38]

> "而且我们的流量也少，你可以看到总共只有 30 个请求。30 个请求不够，所以我们看到这种不寻常的行为。"
> —— p087 [30:03]

> "基本上它就是一个跑在这个 URL 上的 Gradio 应用。用户在 Gradio UI 上输入消息，消息经过 TensorZero Gateway 到 OpenAI 或 Groq API。"
> —— p088 [00:26]

> "如果你显式传 variant 名，你就可以覆盖它（episode 锁定）。"
> —— p088 [08:02]

> "所以试着做一个项目，不要在这个 Gradio 里，试着在 VS Code 里做正规的模块化编码，把 LLM gateway 和 AWS guardrail 集成进去。"
> —— p088 [08:30]

> "AWS、NVIDIA Nemo。你可以用其中任何一个。我讲过 AWS guardrails。"
> —— p088 [09:28]

---

## 3. 从零复现

下面每一步都对应逐字稿里的一个动作，顺序也基本一致。**遇到版本差异，先看第 7 节**。

### 3.1 环境与依赖

你需要四样东西同时跑起来：

1. **TensorZero Gateway**（本地进程，默认监听 3000 端口——端口号课里没有明说，以你启动时打印的地址为准）。
2. **Postgres**（TensorZero 用来存 inferences、episodes、feedback；讲师的数据库就“跑在本地 PC 上”）。
3. **Python 3.11+ 的 Jupyter 环境**（Module 4 的所有实验都在 notebook 里）。
4. **Gradio**（P088 里讲师现场装的：“你可以看到我们在这里安装了 Gradio”）。

`requirements.txt`（版本课里没讲，用能装上最新版即可）：

```txt
tensorzero
gradio
pandas
psycopg2-binary
python-dotenv
openai
groq
```

`.env`（变量名课里没讲，这里按“本地开发最小集合”给；Key 是你自己的）：

```bash
OPENAI_API_KEY=sk-xxxx
GROQ_API_KEY=gsk_xxxx
TENSORZERO_CLICKHOUSE_URL=http://localhost:8123
TENSORZERO_POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/tensorzero
```

> 说明：TensorZero 的存储后端在不同版本里有 ClickHouse 与 Postgres 两种选择。讲师在 P087 明确说“所有数据都存到 Postgres”，所以这里以 Postgres 为准；如果你装的版本默认走 ClickHouse，以官方 `docker-compose` 为准，课里没讲这部分细节。

### 3.2 启动 gateway 并确认它在跑

P088 开头讲师做的第一件事，是“清空输出、跑一下，看 gateway 是不是还活着”。

```bash
# 在项目根目录，用官方 docker compose 起 gateway + 数据库（课里没给具体 compose 文件，以你安装版本为准）
docker compose up -d

# 确认 3000 端口有响应
curl -s http://localhost:3000/health
```

如果没有 Docker，也可以用 pip 安装后直接起：

```bash
tensorzero-gateway --config-file config/tensorzero.toml
```

**关键动作**：每次你改完 `tensorzero.toml`，都要**重启 gateway** 才生效。讲师在静态 A/B 那段反复强调：“你必须重启 gateway，然后才能再跑一遍同样的流程。”

### 3.3 写静态 A/B 的配置（0.5 / 0.5）

讲师原话是“我们修改 tensor0.toml，把两个 variant 配成相同权重”，然后屏幕上出现的是一个 `ab_test` 函数：

- 函数名：`chat_ab`（讲师念作“chat ab”）
- 第一个 variant：OpenAI GPT-4 mini，`weight = 0.5`
- 第二个 variant：Groq Llama，`weight = 0.5`

对应文件见第 4 节 `config/tensorzero.toml`（静态版）。**注意**：讲师用的字段就叫 `weight`，他也明确说这个字段在 TensorZero 里“正在被废弃，2027 年可能就没有了”，新版可能改成 `experimentation` 段，所以你的版本如果报“未知字段 weight”，请按你安装版本的文档改写，课里没讲新版写法。

### 3.4 发 20 个请求，观察切分

P087 [11:02]–[12:27] 的完整动作：

1. 在 notebook 里 `client = get_client()`（见第 4 节代码）。
2. 循环 20 次，每次问同一个函数 `chat_ab`，消息随便（讲师用的是“这是什么”“讲个笑话”之类）。
3. 每次打印 `response.variant_name`，肉眼数一下多少个去了 `openai_gpt4mini`、多少个去了 `groq_llama`。
4. 讲师实际结果是 **12 个 Groq、8 个 GPT**，也就是 60/40，不是严格的 50/50。

讲师对这一点的解释必须原样保留：**20 个请求太少，权重只有在几千、几万个请求时才“像那么回事”**。他还补了一句“我不想浪费那么多 token，所以只发了 20 个；你要是钱多，可以发 1000 个，那大概就是 0.5/0.5 了”。

![p087 11:47 讲师用 20 个请求演示 50/50 流量切分](images/p087_0707s.jpg)

### 3.5 把权重改成 0.8 / 0.2，再跑 20 个请求

1. 打开 `config/tensorzero.toml`，把 `openai_gpt4mini` 的 `weight` 改成 `0.8`，`groq_llama` 改成 `0.2`。
2. **重启 gateway**。
3. 再跑 20 个请求。

讲师实际看到的是：绝大多数请求都去了 GPT，只有零星几个去了 Groq，他在 [13:21] 说“大概 85/20，有点不匹配，因为请求数太少”。然后他打开 **inferences 页面**，能看到“最近三条去了 Groq，这些去了 GPT”，并说“如果你想，可以把两边并排比较”。

![p087 05:21 静态 A/B 配置里 OpenAI 0.8、Groq 0.2 的权重](images/p087_0321s.jpg)

讲师还给了一组对照数字（[14:18]）：“50/50 那格是 8 和 12，80/20 那格是 17 和 3，考虑到只有 20 个请求，这已经挺好了。”他还特别强调：**TensorZero 自己也不承诺严格按比例切**，“它说的是 similar，不是 exactly 80-20 split”。

### 3.6 演示 routing lock-in（会话级模型锁定）

这是 P087 后半段最重要的概念，讲师自己也说“这个我本该在 provider routing 那节讲，当时漏了，现在补上”。

**先演示“没有锁”会怎样**（[16:15]–[17:14]）：

- 同一个用户连续问 5 个问题；
- 第 1、2 问被 GPT 回答，第 3、4 问被 Groq 回答，第 5 问又回到 GPT；
- 用户根本不知道背后换了模型；
- 最后你问他“这段对话好不好”，他的反馈是**对混合模型整体的评价**，不是对某一个模型的评价；
- 结论：**反馈数据被污染，A/B 实验失效**。

![p087 18:12 路由锁定让同一 episode 的所有轮次走同一个模型](images/p087_1092s.jpg)

**再做“有锁”的版本**（[19:11]–[21:37]）：

1. 把权重改回 0.5 / 0.5，重启 gateway。
2. 准备 3 个 session，每个 session 问 3 个问题：
   - session 1：`episode_id = "ep-1"`，问题 A/B/C
   - session 2：`episode_id = "ep-2"`，问题 A/B/C
   - session 3：`episode_id = "ep-3"`，问题 A/B/C
3. 关键：**把 `episode_id` 传进 `client.chat(...)`**。
4. 结果：session 1 的第一轮落到 Groq，第 2、3 轮也全是 Groq；session 2 第一轮落到 GPT，后面全是 GPT；session 3 第一轮落到 Groq，后面全是 Groq。
5. 打开 **episodes 页面**核对：episode 1 是 GPT variant，episode 2 是 Groq variant，episode 3 是 Groq variant。

讲师在这里澄清了一个容易混的点（[18:11]）：“episode 本身只是把多次推理聚成一组，它不负责锁模型；真正让模型锁住的是把 episode 和 routing 绑在一起用。”他又在 [20:38] 补了一句：“概念上 episode 和 routing lock 是两回事，但底层技术是同一个东西——就是 episode。”

> 给前端同学的一句话：这里的 “lock” **不是**数据库锁、也不是 JS 里的 `Mutex`，它是**会话粘性（sticky session）**。在 Node/Express 里等价于“第一次请求给用户发个 cookie 存 variant 名，后面所有请求读 cookie 强制指定 variant”。讲师在 P088 [08:02] 也验证了这一点：“如果你显式传 variant 名，就可以覆盖 episode 的锁定。”

### 3.7 反馈闭环：给每次推理打 thumbs up / thumbs down

讲师在 [22:03]–[22:32] 讲了两件事：

1. **为什么要反馈**：没有反馈，你就不知道 80/20 该往哪边调。
2. **怎么打反馈**：`client.feedback`，参数是 `inference_id` + `metric`（`thumbs_up` 或 `thumbs_down`）。

![p087 22:29 用 client.feedback 给 inference 打 thumbs up / thumbs down](images/p087_1349s.jpg)

因为讲师没有真实用户，他**模拟**了反馈（[22:32]）：“我们注入假指标。GPT 的响应 80% 概率拿到 thumbs up，Groq 只有 40% 概率。”

然后跑 [23:01] 的统计 cell，结果（[24:00]–[24:28]）：

- GPT variant：**8 个请求，8 次 thumbs up**，平均质量 **0.89**
- Groq variant：**12 个请求，只有 4 次 thumbs up**，平均质量 **0.53**

> 注意：8 次 thumbs up 却算出 0.89 而不是 1.0，说明讲师那次模拟里实际是“8 个请求里有几次 thumbs up”的四舍五入显示，**具体口径以你跑出来的 SQL 为准**。文档里只复述讲师屏幕上的数字，不替他改口径。

这些数据全在 Postgres 里，讲师的原话是：“你可以用 SQL 查询编辑器连上去，跑查询看用户到底喜不喜欢。”他给的查询就是按 variant 分组算 thumbs up 比例，见第 4 节 SQL。

![p087 24:37 在 SQL 编辑器里按 variant 统计平均质量](images/p087_1477s.jpg)

拿到「GPT 0.89 > Groq 0.53」这个结论后，**手动**回 `tensor0.toml` 把权重改成 0.8/0.2，重启 gateway——这就是完整的**静态 A/B 闭环**。

### 3.8 换成自适应 A/B（adaptive）

讲师在 [25:24] 说：“weight 这个字段很快要废弃，所以我们要转向 adaptive。”操作步骤：

1. **新建**一份 toml（别覆盖静态那份，方便对照）。
2. 把 `weight` 字段整段删掉。
3. 在函数下写 `type = "adaptive"`。
4. 写 `candidates = ["openai_gpt4mini", "groq_llama"]`（讲师说“两个、三个、四个候选都行，四个就是每个先 0.25”）。
5. 写 `metric = "thumbs_up"`。

讲师在 [27:18] 解释了 metric 的方向性，这段必须原样理解：**`thumbs_up` 是正向指标，哪个 variant 的 thumbs up 多，权重就往哪边加；如果改成 `thumbs_down`，逻辑就反过来——负向投票少的那个权重更高，也就是“成反比”。**

![p087 26:49 自适应 A/B 的 toml：adaptive + candidates + metric](images/p087_0835s.jpg)

> 图片说明：这张帧对应讲师展示 `[functions.chat.ab_experimentation]` 配置的时刻，能看到 `type = "adaptive"` 和 `candidates` 两个关键字段。

### 3.9 跑自适应实验：3 轮 × 10 请求

讲师在 [27:46]–[29:08] 的做法：

1. 设 `ROUNDS = 3`，每轮 10 个请求。
2. 每个请求拿到 `inference_id` 后，**随机**打 thumbs up / thumbs down（他说“我们不是在问真实用户，是在模拟”）。
3. 每轮结束**等 65 秒**，因为“gateway 要更新权重、要重启，所以得等”。
4. 跑完 3 轮看结果。

实际结果（[29:38]–[30:03]）：

- 第 1 轮：50/50；
- 第 2 轮：GPT 占比明显变高，切过去了；
- 第 3 轮：又切回去了；
- 讲师自己的评价是“性能很不均匀，因为自适应算法本身还在实验阶段，而且我们总共只有 30 个请求，数据太少”。

![p087 30:03 自适应实验里 inference 的 feedback 值（true / false）](images/p087_0964s.jpg)

> 图片说明：这张帧对应讲师打开单条 inference 查看 `thumbs_up` 为 true/false 的时刻。

### 3.10 P088：把一切组装成 Gradio 客服机器人

讲师在 P088 开场的定位是：“我们做一个客户支持 chatbot，公司名随便叫 Tech Learn Academy 或 Krishna Academy。”

完整流程（对应逐字稿时间点）：

1. **[00:26] 架构**：用户在 Gradio UI 输入 → TensorZero Gateway → OpenAI / Groq。
2. **[00:55] 复用清单**：system prompt、minijinja template、episode locking、provider routing、feedback API、observability，全部来自 Module 1–4。
3. **[01:02] 装 Gradio + 检查 gateway**：“我们安装了 Gradio，也在检查 gateway 是否在跑。”
4. **[01:23] 配置 gateway**：创建两个 variant，写 `tensor0.toml`。讲师说“toml 我已经讲过很多次了，不再讲，直接看效果”。
5. **[01:52] 应用逻辑**：`get_client()` 创建 client；发消息的函数负责“把消息发给对应 provider，同时锁定 episode”；还有“新对话”函数、发反馈的函数（thumbs up）。
6. **[03:07] 清理端口**：先检查端口上有没有残留进程，有就杀掉。“如果你跑完 Gradio 关不掉，就再跑一下上面那个 cell，就能关掉。”
7. **[03:42] 起 UI**：`demo.launch()`，讲师用 `Ctrl+点击` 打开本地 URL（他在 [04:11] 说 “localhost seven…”，具体端口以你终端打印为准，Gradio 默认 7860）。
8. **[04:11] 第一次对话**：输入“I want to raise a query”，机器人回“of course, please let me know about your query…”。
9. **[04:39] 核对 inference**：打开 inferences 页面，最新一条就是刚才那句“I want to raise a query”；打开 episodes 页面能看到 episode，还能选 model；当前走的是 automatic A/B。
10. **[04:39] 点“good response”**：反馈写回 TensorZero，再刷新那条 inference，`thumbs_up` 变成 `true`（讲师强调“之前它不是 true”）。
11. **[05:08] 继续多轮**：再问 “can you tell me more about yourself?”，机器人回“I am Maya, your friendly support…”。
12. **[05:34] 看 episode**：episode 页面显示 2 条 inference，两条都在同一 episode 下，**而且都锁在 GPT**（讲师说“所有轮次都锁到 GPT 了”）。
13. **[06:04] 点“bad response”**：刷新，前一条是 `true`、这一条是 `false`，“这样你就能算平均”。
14. **[06:33] 再问 billing**：“what type of billing data you can tell”，机器人回“course fees, subscription plan, payment processing”。
15. **[07:03] 再看 episode**：3 条 inference，全是同一会话历史；再点 good response，刷新，`user satisfied = true`。
16. **[07:16] 强制指定 Groq**：讲师在请求里**显式传 `variant_name = "groq_llama"`**，覆盖掉 episode 的自动锁定。结果第 4 条 inference 真的落到 Groq。讲师评论：“没人会在 GPT 会话中间硬切 Groq，但为了演示还是做了”，然后给它点了 bad response，`user satisfied` 变成 `false`。

![p088 05:53 在 episode 页面看到同一会话的多轮推理](images/p088_0353s.jpg)

![p088 07:16 显式传 variant_name 覆盖 episode 锁定，第 4 条落到 Groq](images/p088_0436s.jpg)

### 3.11 安全加固与后续（讲师在结尾提到的）

- **[08:30] 给项目的建议**：不要在 Gradio 单文件里写，去 **VS Code 做模块化**，然后把 **LLM Gateway（TensorZero）和 AWS Guardrails** 集成进去。
- **[08:59] 演示“没有 guardrail 的风险”**：用户问“给我一个做饭食谱”，机器人虽然没直接给食谱，但“仍然多说了几句、推荐了一些课程以外的东西”，讲师说“我们不想这样，这种就要靠 guardrail 拦掉”。
- **[09:28] 可选的 guardrail**：AWS Guardrails、NVIDIA NeMo，任选其一；“AWS guardrails 我在另一节课讲过”。
- **[09:28] 后续课程预告**：observability、Prometheus、Grafana、Grafana metrics、Grafana trace、Grafana Tempo、OpenTelemetry，以及缓存部分的 Redis。**这些在本段两集里没有实现，只是预告。**
- **[09:57] 对 TensorZero 的评价**：“它是最好的 LLM gateway 之一，也被低估了；很多人只看 LiteLLM，但 TensorZero 值得用。”

---

## 4. 完整代码

> **重要声明**：本段逐字稿**没有给出完整源码**，也没有任何 OCR 结果。下面所有文件是**根据讲师口述的字段名、函数名、参数名还原的最小可运行骨架**。凡是从逐字稿直接来的字段，我在注释里标 `# 逐字稿原话`；凡是我为了让文件能跑而补的部分，标 `# 课里没讲，按官方文档补`。你安装的 TensorZero 版本如果字段对不上，以你本地报错和官方文档为准，不要硬套。

### 4.1 `requirements.txt`

```txt
# 课里没讲版本号，以下为写作时的可用写法，锁定版本请用 pip freeze
tensorzero
gradio
pandas
psycopg2-binary
python-dotenv
openai
groq
```

### 4.2 `.env`

```bash
# 课里没讲变量名，按 TensorZero 本地开发的常见约定给
OPENAI_API_KEY=sk-你的key
GROQ_API_KEY=gsk_你的key

# 讲师的数据库跑在本地 Postgres（P087 [06:45]）
TENSORZERO_POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/tensorzero

# 如果你的版本用 ClickHouse 存 observability，再加这一行
TENSORZERO_CLICKHOUSE_URL=http://localhost:8123
```

### 4.3 `config/tensorzero.toml`（静态 A/B 版，0.5 / 0.5）

```toml
# 讲师口头叫 tensor0.toml，实际路径以你安装版本为准

[functions.chat_ab]
type = "chat"                                   # 逐字稿原话：chat ab 函数

[functions.chat_ab.variants.openai_gpt4mini]
type = "chat_completion"                        # 课里没讲，TensorZero 通用写法
model = "openai::gpt-4o-mini"                   # 逐字稿原话：OpenAI GPT-4 mini
weight = 0.5                                    # 逐字稿原话：weight = 0.5

[functions.chat_ab.variants.groq_llama]
type = "chat_completion"                        # 课里没讲
model = "groq::llama-3.1-8b-instant"            # 逐字稿原话：Groq Llama
weight = 0.5                                    # 逐字稿原话：weight = 0.5
```

**改成 80/20 时只动两行**（讲师在 [12:54] 就是这么做的）：

```toml
weight = 0.8   # openai_gpt4mini
weight = 0.2   # groq_llama
```

改完**必须重启 gateway**。

### 4.4 `config/tensorzero.toml`（自适应 A/B 版）

```toml
# 逐字稿 [25:24]：weight 字段要废弃，换成 adaptive
# 逐字稿 [26:49]：functions.chat.ab_experimentation, type = adaptive,
#                 candidates = [...], metric = thumbs_up

[functions.chat_ab]
type = "chat"

[functions.chat_ab.variants.openai_gpt4mini]
type = "chat_completion"
model = "openai::gpt-4o-mini"

[functions.chat_ab.variants.groq_llama]
type = "chat_completion"
model = "groq::llama-3.1-8b-instant"

[functions.chat_ab.experimentation]              # 课里没讲段名，按 TensorZero 实验段约定
type = "adaptive"                               # 逐字稿原话
candidates = ["openai_gpt4mini", "groq_llama"]  # 逐字稿原话：candidates
metric = "thumbs_up"                            # 逐字稿原话：先按正向投票
```

> 讲师在 [26:52] 还提到 “functions.chat” 这个前缀，他屏幕上的函数名可能是 `chat`，这里为了跟静态版区分写成 `chat_ab`。**函数名以你 toml 里实际写的为准，客户端调用时 `function_name` 必须一模一样。**

### 4.5 `notebooks/01_static_ab.ipynb`（静态 A/B：20 请求 + 反馈）

```python
# cell 1：初始化 client
# 逐字稿 [10:04]：先确认 gateway 在跑
from tensorzero import TensorZeroGateway

def get_client():
    # 逐字稿 [01:52]：get client 会创建 client
    return TensorZeroGateway.build_http(gateway_url="http://localhost:3000")

client = get_client()
print("gateway client ready")
```

```python
# cell 2：发 20 个请求，数每个 variant 落了多少
# 逐字稿 [11:02]：20 个请求，50/50 会自动切
import collections

counts = collections.Counter()
inference_ids = []

client = get_client()
for i in range(20):
    resp = client.chat(
        function_name="chat_ab",
        messages=[{"role": "user", "content": f"第 {i} 个测试问题：简单介绍一下你自己"}],
    )
    counts[resp.variant_name] += 1
    inference_ids.append(resp.inference_id)
    print(i, resp.variant_name)

print("统计：", dict(counts))
# 讲师实测：groq_llama 12、openai_gpt4mini 8（不是严格 50/50）
```

```python
# cell 3：模拟反馈（GPT 80% 好评，Groq 40% 好评）
# 逐字稿 [22:32]：我们注入假指标
import random

for iid in inference_ids:
    # 先查这条 inference 是哪个 variant 产生的——课里没讲查询 API，
    # 这里用最直接的方式：重发一次拿 variant_name 不可靠，
    # 所以把 variant 和 id 一起存下来更稳（见 cell 2 的改进版）
    pass

# 改进版：cell 2 里同时存 variant_name
records = []  # [(inference_id, variant_name), ...]

for iid, variant in records:
    p = 0.8 if variant == "openai_gpt4mini" else 0.4
    value = random.random() < p
    client.feedback(
        inference_id=iid,
        metric_name="thumbs_up",   # 逐字稿原话：metric 是 thumbs up
        value=value,               # True = thumbs up, False = thumbs down
    )
print("feedback sent:", len(records))
```

> `client.feedback` 的参数名在不同版本里可能是 `metric_name` / `metric`，以你本地报错为准。讲师只说了“你给 inference ID，metric 是 thumbs up thumbs down”，没有念参数名。

### 4.6 `notebooks/02_routing_lock.ipynb`（episode 锁定实验）

```python
# 逐字稿 [19:39]：三个 session，每个 session 三个问题
# 关键：把 episode_id 传进去，第一轮落到哪个 variant，后面就锁哪个
client = get_client()

questions = [
    "什么是 LLM gateway？",
    "它有什么好处？",
    "TensorZero 和其他方案比怎么样？",
]

for ep in ["ep-1", "ep-2", "ep-3"]:
    print(f"\n=== session {ep} ===")
    for q in questions:
        resp = client.chat(
            function_name="chat_ab",
            messages=[{"role": "user", "content": q}],
            episode_id=ep,          # 逐字稿原话：用 episode 锁定
        )
        print(q[:12], "->", resp.variant_name)
```

**预期输出**（讲师 [21:08] 的实测）：

```
=== session ep-1 ===
什么是 LLM ga -> groq_llama
它有什么好处 -> groq_llama
TensorZero 和 -> groq_llama

=== session ep-2 ===
什么是 LLM ga -> openai_gpt4mini
它有什么好处 -> openai_gpt4mini
TensorZero 和 -> openai_gpt4mini

=== session ep-3 ===
什么是 LLM ga -> groq_llama
它有什么好处 -> groq_llama
TensorZero 和 -> groq_llama
```

> 你的 session 1 可能是 GPT 而不是 Groq，**这取决于第一轮随机落到谁**；重点是“同一 session 内三轮一致”。

### 4.7 `notebooks/03_feedback_sql.ipynb`（反馈统计 SQL）

```python
# 逐字稿 [24:00]：所有数据存在 Postgres，用 SQL 编辑器查
import psycopg2
import pandas as pd
import os

conn = psycopg2.connect(os.environ["TENSORZERO_POSTGRES_URL"])

sql = """
SELECT
    variant_name,
    COUNT(*)                                   AS requests,
    SUM(CASE WHEN value = TRUE THEN 1 ELSE 0 END) AS thumbs_up,
    AVG(CASE WHEN value = TRUE THEN 1.0 ELSE 0.0 END) AS avg_quality
FROM feedback
GROUP BY variant_name;
"""

df = pd.read_sql(sql, conn)
print(df)
conn.close()
```

> **表名 / 列名课里没讲**。讲师只展示了结果（GPT：8 请求 / 8 thumbs up / 平均 0.89；Groq：12 请求 / 4 thumbs up / 平均 0.53），没有念出表结构。上面 SQL 是示意，你需要在 Postgres 里先 `\dt` 看一下实际表名和字段名再改。

### 4.8 `notebooks/04_adaptive_ab.ipynb`（自适应 A/B：3 轮 × 10 请求）

```python
# 逐字稿 [27:46]–[29:08]：3 轮，每轮 10 个请求，每轮后等 65 秒
import time, random, collections

client = get_client()
ROUNDS = 3
REQUESTS_PER_ROUND = 10
WAIT_SECONDS = 65          # 逐字稿原话：等 gateway 更新权重

for r in range(1, ROUNDS + 1):
    print(f"\n===== round {r} =====")
    counts = collections.Counter()
    ids = []
    for i in range(REQUESTS_PER_ROUND):
        resp = client.chat(
            function_name="chat_ab",
            messages=[{"role": "user", "content": f"round {r} request {i}"}],
        )
        counts[resp.variant_name] += 1
        ids.append(resp.inference_id)

    print("本轮切分：", dict(counts))

    # 逐字稿：随机反馈（因为没真实用户）
    for iid in ids:
        client.feedback(
            inference_id=iid,
            metric_name="thumbs_up",
            value=random.random() < 0.5,
        )

    if r < ROUNDS:
        print(f"等 {WAIT_SECONDS} 秒让 gateway 更新权重...")
        time.sleep(WAIT_SECONDS)
```

> 讲师实测就是“第 1 轮 50/50、第 2 轮偏 GPT、第 3 轮又切回去”。**这不是你代码错了**，是数据太少 + 算法还在实验阶段。

### 4.9 `app/gradio_app.py`（P088 客服机器人）

> **注意**：这一份是**按讲师口述的模块结构还原的示意代码**（get_client / 发消息并锁 episode / 新对话 / 反馈）。讲师在视频里没有逐行讲 Gradio 代码，他说“不要看代码，只看概念”。我用 `gr.ChatInterface` 做一个等价实现；如果你要严格复刻他屏幕上的 UI，需要自己对照视频重写布局。

```python
# app/gradio_app.py
# 课里没有给出完整源码，以下是按 P088 口述结构还原的示意实现
import os
import gradio as gr
from tensorzero import TensorZeroGateway

GATEWAY_URL = "http://localhost:3000"
FUNCTION_NAME = "chat_ab"

def get_client():
    """逐字稿 [01:52]：get client 会创建 client"""
    return TensorZeroGateway.build_http(gateway_url=GATEWAY_URL)

client = get_client()

# 用一个全局变量模拟“当前会话的 episode_id”
# 真实项目里应该按用户 session 存，课里没讲
CURRENT_EPISODE = {"id": None}

def new_conversation():
    """逐字稿 [02:22]：new conversation 按钮"""
    import uuid
    CURRENT_EPISODE["id"] = str(uuid.uuid4())
    return [], f"新会话：{CURRENT_EPISODE['id']}"

def chat_fn(message, history):
    """逐字稿 [01:52]：把消息发给 provider，同时锁定 episode"""
    resp = client.chat(
        function_name=FUNCTION_NAME,
        messages=[{"role": "user", "content": message}],
        episode_id=CURRENT_EPISODE["id"],   # 关键：锁 episode
    )
    # 把 inference_id 挂在返回对象上，供反馈按钮使用
    # Gradio ChatInterface 不支持返回额外元数据，这里简化成打印
    print("inference_id =", resp.inference_id, "variant =", resp.variant_name)
    LAST_INFERENCE["id"] = resp.inference_id
    return resp.content

LAST_INFERENCE = {"id": None}

def send_feedback(good: bool):
    """逐字稿 [02:49]：feedback 发送 thumbs up"""
    if not LAST_INFERENCE["id"]:
        return "还没有可反馈的推理"
    client.feedback(
        inference_id=LAST_INFERENCE["id"],
        metric_name="thumbs_up",
        value=good,
    )
    return "反馈已发送"

with gr.Blocks() as demo:
    gr.Markdown("# Tech Learn Academy 客服机器人")
    chatbot = gr.ChatInterface(fn=chat_fn)

    with gr.Row():
        new_btn = gr.Button("New conversation")
        good_btn = gr.Button("Good response")
        bad_btn = gr.Button("Bad response")

    status = gr.Textbox(label="状态", interactive=False)

    new_btn.click(new_conversation, outputs=[chatbot.chatbot, status])
    good_btn.click(lambda: send_feedback(True), outputs=status)
    bad_btn.click(lambda: send_feedback(False), outputs=status)

if __name__ == "__main__":
    # 逐字稿 [03:42]：起 UI，讲师用 Ctrl+点击打开本地 URL
    demo.launch()
```

### 4.10 清理端口（P088 [03:07]）

```python
# 逐字稿：如果 Gradio 关不掉，跑这个 cell 就能关掉
# 课里没给具体实现，下面是 Linux/macOS 的等价写法
import subprocess
subprocess.run("lsof -ti:7860 | xargs kill -9", shell=True)
```

### 4.11 强制指定 variant（P088 [07:16]）

```python
# 逐字稿 [08:02]：显式传 variant 名可以覆盖 episode 锁定
resp = client.chat(
    function_name="chat_ab",
    messages=[{"role": "user", "content": "force fees, what type of course fees?"}],
    episode_id=CURRENT_EPISODE["id"],
    variant_name="groq_llama",   # 强制走 Groq
)
print(resp.variant_name)  # 期望输出 groq_llama
```

---

## 5. 逐行解释

### 5.1 为什么是 `weight = 0.8` / `0.2`，而不是 80 / 20

讲师在 [02:19] 讲得很清楚：**权重是 0 到 1 的小数，不是百分数**。0.8 表示“这个 variant 承接 80% 的流量”。写成 `80` 会被当成 80 倍权重，切分就完全错了。讲师在 [05:17] 又用 1000 个用户举了一遍例子：0.8 意味着大约 800 个用户去 OpenAI、大约 200 个去 Groq。

### 5.2 为什么 20 个请求切不准

讲师 [11:27] 原话：“这个权重只有在几千、几万个请求时才有效；20 个请求太小了。” 这是一个统计问题，不是配置问题——每次请求独立按权重抽样，样本量 20 的方差很大；样本量 1000 以上才会收敛到 0.5/0.5。**不要因为 20 个请求切出 12/8 就以为配置写错了。**

### 5.3 为什么改完 toml 必须重启 gateway

讲师在 [07:15] 说“你必须重启 gateway，然后才能跑同样的流程”。原因是 gateway 启动时读一次配置到内存，运行中不会热加载。**在 Node 里对应“改了 `.env` 必须重启 `node server.js`”**，不是 webpack 那种热更新。

### 5.4 为什么要有 `episode_id`

`episode_id` 把同一用户同一会话的多轮推理聚成一组。它有两个作用：

1. **可观测**：episodes 页面能一次看完整段对话，而不是散落的单条 inference（P088 [05:34] 讲师就是这么核对的）。
2. **routing lock 的载体**：第一轮落到哪个 variant，后续轮次自动沿用。讲师 [20:38] 说“概念上 episode 和 routing lock 是两回事，但底层技术是同一个东西”。

### 5.5 为什么没有 routing lock 反馈就不可信

讲师 [17:14] 的原话：用户不知道背后换了模型，他给的是“对整段混合对话”的评价。你拿这个评价去判断“GPT 好还是 Groq 好”，等于拿混合信号做归因，**A/B 实验直接失效**。所以必须先锁、再收集反馈，才能得到“clean A/B metrics”（讲师 [19:11] 用的词）。

### 5.6 `metric = "thumbs_up"` 和 `metric = "thumbs_down"` 的方向为什么相反

讲师 [27:18] 解释得很清楚：

- `thumbs_up`（正向）：**谁的正向投票多，谁的权重高**。
- `thumbs_down`（负向）：**谁的负向投票少，谁的权重高**——所以是“成反比”。

你在 toml 里选哪个，取决于你采集的是“点赞”还是“点踩”。两个都采集就选一个主指标，另一个只做展示。

### 5.7 为什么自适应实验会出现“第 2 轮偏 GPT、第 3 轮又切回去”

讲师 [29:38] 和 [30:03] 给了两个原因：

1. **算法本身还在实验阶段**（“TensorZero 的 adaptive 还在 experimentation phase，可能不会工作得那么好”）。
2. **数据太少**（“总共只有 30 个请求，30 个请求不够，所以我们看到这种不寻常的行为”）。

他的建议是：**真实流量上去之后会稳定**。所以你在本地复现看到抖动是正常的，不要改代码去“修”它。

### 5.8 为什么 P088 要“不要在 Gradio 里写”

讲师 [08:30] 的原话是“不要在 Gradio 里做，去 VS Code 做正规的模块化编码”。原因他没展开，但从工程角度看：Gradio 单文件没法做依赖注入、没法写测试、没法拆 provider，更没法接 guardrail。**这是讲师明确给的项目建议，不是可选项。**

### 5.9 为什么 system prompt 挡不住“做饭食谱”

讲师 [08:59] 演示了：你问“给我做饭食谱”，机器人虽然没直接给食谱，但“还是多说了几句、推荐了一些课程以外的东西”。这说明 **system prompt 只能软约束，不能硬拦截**。硬拦截要靠 guardrail（AWS Guardrails / NVIDIA NeMo），P088 只提到名字，没有实现。

### 5.10 JS/Node 对照

- `episode_id` ≈ 服务端 session id / 前端 cookie 里的 conversation id。
- routing lock-in ≈ **sticky session**（Nginx `ip_hash`、或自己存 `userId -> variant` 映射）。
- `client.feedback(...)` ≈ 埋点上报（`analytics.track("thumbs_up", { inferenceId })`）。
- 这里的 “lock” **不是** `Mutex` / 数据库行锁，不要联想成并发控制。

---

## 6. 复现检查清单

按顺序打勾，任何一项不对就先停下来排查，不要往下走。

**环境**
- [ ] `docker compose up -d` 或 `tensorzero-gateway --config-file ...` 启动成功
- [ ] `curl http://localhost:3000/health` 有响应
- [ ] Postgres 可连接（`psql $TENSORZERO_POSTGRES_URL -c '\dt'` 能看到表）
- [ ] `pip install -r requirements.txt` 无报错
- [ ] `.env` 里 `OPENAI_API_KEY` / `GROQ_API_KEY` 都有值

**静态 A/B**
- [ ] `config/tensorzero.toml` 里两个 variant 的 `weight` 都是 0.5
- [ ] 重启 gateway 后，20 个请求大致切成两边（允许偏，例如 12/8）
- [ ] 把权重改成 0.8/0.2，重启，再跑 20 个请求，明显偏向 GPT
- [ ] inferences 页面能看到每条推理对应的 variant
- [ ] 讲师对照数字：50/50 那轮约 8 和 12；80/20 那轮约 17 和 3

**反馈闭环**
- [ ] `client.feedback(inference_id=..., metric_name="thumbs_up", value=True)` 不报错
- [ ] 刷新 inferences 页面，对应条目的 thumbs_up 变成 `true`
- [ ] 再发一条 `value=False`，刷新后变成 `false`
- [ ] SQL 能按 variant 分组算出请求数、thumbs up 数、平均质量
- [ ] 讲师屏幕上的参考值：GPT 8 请求 / 8 thumbs up / 0.89；Groq 12 请求 / 4 thumbs up / 0.53（**口径以你的 SQL 为准**）

**Routing lock**
- [ ] 三个 session 分别用 `ep-1` / `ep-2` / `ep-3`
- [ ] 每个 session 内三轮的 `variant_name` 完全一致
- [ ] episodes 页面能看到每个 episode 对应一个固定 variant
- [ ] 显式传 `variant_name="groq_llama"` 能覆盖 episode 锁定

**自适应