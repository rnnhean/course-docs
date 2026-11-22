# Vector Databases Fundamentals to Production — P15–P20 复现文档

> 覆盖范围：P15（LLM 是什么）、P16（课程插播）、P17（开发环境准备）、P18（安装 VS Code / Python / OpenAI API Key）、P19（ChromaDB 工作流讲解）、P20（用 ChromaDB 写第一个向量数据库脚本）。
>
> 说明：本段课程**没有 OCR 结果**，所有代码均来自逐字稿中讲师口述的屏幕操作。逐字稿里讲师没有逐字念出完整代码，因此第 4 节「完整代码」是根据讲师口述的每一步操作**还原**出的可运行文件，并在每处标注了对应的时间点。凡是逐字稿没讲的内容，一律写「课里没讲」。

---

## 1. 这一节做什么

这一段课是整门课的「地基 + 第一次动手」。它分成两半：

**前半段（P15）是概念铺垫**：讲师先解释什么是大语言模型（LLM）——它本质上是一个在海量文本上训练出来的算法，目标是生成「像人写的」文本；训练分两步（无监督学习 → 有监督学习 + 微调）；核心结构是 Transformer，而 Transformer 里最关键的是 **self-attention（自注意力）机制**，它负责捕捉词与词之间的关系和上下文语义。这一段不写代码，但它是后面所有「embedding / 向量 / 相似度」概念的来源，所以必须理解。

**后半段（P17–P20）是环境搭建 + 第一个可运行项目**：安装 VS Code、Python、注册 OpenAI 账号拿 API Key；然后讲清楚 ChromaDB 在生产环境里的完整工作流（App 层 → 生成 query embedding → ChromaDB 做相似度检索 → 把检索结果塞进 LLM 上下文窗口 → LLM 生成答案 → 返回用户）；最后在 VS Code 里从零写一个 `app.py`，用 ChromaDB 建 collection、插入 3 条文档、跑一次 query，并打印出带 distance 的检索结果。

**这一段结束时你应该拥有的东西**：一个能跑通的 Python 脚本，运行后终端打印出 3 条文档的 ID、distance 和文本内容，其中 `doc1`（"hello world"）的 distance 最接近 0，因为查询词就是 "hello world"。

---

## 2. 讲师原话

> "大语言模型本质上就是一个算法——不只是因为它『很重』，而是从概览上说，你可以把它想成一个在海量数据、文本数据上训练出来的算法。它的目标是生成像人写的文本。"
> —— p015 [00:00]

> "训练这个过程之前必须先有数据收集。会收集文本数据，有时还有音频、图像等等，用来训练这个语言模型，让它具备核心知识。"
> —— p015 [01:24]

> "训练过程有几个步骤。第一步叫无监督学习，在这个阶段模型开始学习词与概念之间的关系。之后是微调，微调发生在有监督学习之后。"
> —— p015 [01:51]

> "训练数据会经过一个 Transformer。Transformer 是什么？它是另一种基于神经网络的技术。在这里，输入文本会被分析，从而理解上下文、语义，甚至人类语言的一些细微差别。"
> —— p015 [02:20]

> "Transformer 架构非常复杂，但我先给你看一点点。把神经网络想成你的大脑，大脑里有神经元，神经元之间有连接，形成一张信息网络，训练就发生在那里。"
> —— p015 [03:14]

> "自注意力层的工作，是解码并观察这些词之间的关系，从而帮助得到更好的词编码。编码器有自注意力机制，解码器也有自注意力机制，另外还有编码器-解码器注意力这一层。"
> —— p015 [05:00]

> "自注意力非常重要，因为它帮助解码器聚焦到输入句子里相关的部分，观察整句话的关系和语义，然后才能解析并理解它在另一种语言里是什么意思。"
> —— p015 [05:30]

> "关于 Transformer 架构，我想让你记住的关键词是：它捕捉词与词之间的关系、理解上下文。就像你我对话或阅读时能理解上下文一样。"
> —— p015 [06:25]

> "现在我们要开始构建向量数据库了。这是我们要开始动手、从零构建向量数据库的地方。"
> —— p017 [00:00]

> "在做之前，我们需要把开发环境搭好。第一件事，我会用 VS Code 作为代码编辑器，建议你去装。另外你机器上必须装好 Python，还要有 OpenAI 账号和 API Key。"
> —— p017 [00:09]

> "如果你已经有 VS Code、Python 都装好了，那也没问题，可以直接跳到下一讲。"
> —— p017 [00:38]

> "我们要用 Chroma 来创建一个向量数据库。在往下走之前，我们需要理解 Chroma 数据库的工作流。最上面这一层是应用层，也就是使用 Chroma 数据库的那个应用。"
> —— p019 [00:00]

> "整个想法是：我们把文档以 embedding 的形式存起来，embedding 就是向量，可能包含比向量本身更多的信息。这些数据通常是配合大语言模型的上下文来用的——我们把信息连同查询一起传给大语言模型，然后得到一个答案。"
> —— p019 [00:26]

> "你存数据不是为存而存。大多数情况下，你存是为了能检索出来、做各种事情。"
> —— p019 [00:57]

> "查询（queries）代表什么？就是用户输入到应用里的查询。这些查询形式多样，但通常是基于文本的问题或请求。"
> —— p019 [01:53]

> "生成 embedding 这一步，涉及为查询生成 embedding。记住，要能和向量数据库交互，我们必须把查询——不管是文本还是语音——转成真正的 embedding，因为那才是 Chroma 数据库能用来做语义搜索、相似度计算的『格式语言』。"
> —— p019 [02:19]

> "Chroma 数据库层负责存储和管理 embedding。它包含文档（documents），也就是存在 Chroma 里的文本数据或信息条目，每条文档关联一个 embedding；还有 embedding 本身，也就是文档的向量表示，每个 embedding 对应一条文档，用向量形式表示它的内容，从而支持基于向量距离、度量等的相似度比较和检索。"
> —— p019 [02:47]

> "LLM 上下文窗口是什么？就是那个大语言模型，它用我们拿到的 embedding 去理解查询背后的上下文或意图，然后处理这些 embedding，生成相关且连贯的答案。"
> —— p019 [03:13]

> "答案（answer）是最终输出，由大语言模型发回给用户。这个答案是基于 LLM 对 embedding 的处理和对上下文的理解生成的，而上下文必须由 Chroma 数据库提供。"
> —— p019 [03:56]

> "总结一下流程。第一，用户向应用提交查询。第二，应用用神经网络或类似模型为这个查询生成 embedding——我们可以用 OpenAI 的 embedding，后面会看到。"
> —— p019 [04:18]

> "查询 embedding 要么和 Chroma 数据库里已有的 embedding 比较，找出相关文档；要么直接用来生成答案，走 LLM 上下文窗口。"
> —— p019 [04:46]

> "这个架构让应用能利用深度学习和向量数据库技术来高效处理自然语言查询。因为用了 embedding 和 LLM，系统能比传统关键词搜索更准确地理解和处理复杂查询，能给出上下文相关、语义丰富的回答，从而提升用户体验和交互质量。"
> —— p019 [05:33]

> "这个图——这一讲——你应该经常回来看，用来理解任何数据库。我们这里只是用 Chroma，但任何向量数据库最终都要和真实世界（也就是应用）交互。这个交互要经过大语言模型，相似度搜索、语义搜索都在里面发生，然后喂给 LLM，LLM 因为有知识，就知道怎么处理这些信息、生成用户需要的答案。"
> —— p019 [06:31]

> "我打开了 Visual Studio，是空的，没有任何文件。我们右键新建 `app.py` 作为入口文件。"
> —— p020 [00:00]

> "第一件要做的事，按文档说的，你需要安装 ChromaDB 包。我复制这个，粘贴成 `pip install`。但在那之前，我需要在我的文件夹里创建一个虚拟环境。这在 Python 里非常好，这样你就有专属于这个项目的虚拟环境，不会把各种依赖和包装得到处都是。"
> —— p020 [00:53]

> "创建虚拟环境，我说 `python3 -m venv`，然后给个名字，我就叫 `venv`。如果你在 Windows 上，会有点不同：`python` 或 `py`，然后 `-m`，然后 `venv`，名字随便叫 `myenv` 之类。"
> —— p020 [01:20]

> "现在有了虚拟环境，我说 `source` 进到 `venv/bin` 里激活它。Windows 上不一样，你要进到你给的名字（比如 `myenv`）里的 `Scripts` 目录，然后调用 `activate` 可执行文件。确保虚拟环境已激活。"
> —— p020 [01:45]

> "现在回到安装包：`pip install chromadb`。过一会儿就装好了。接下来复制这些，`import chromadb` 和 client。"
> —— p020 [02:15]

> "我这里有波浪线，我要确保选中解释器，选我虚拟环境下的那个。"
> —— p020 [02:43]

> "现在我们通过调用 `chromadb.Client()` 创建了 ChromaDB 客户端。鼠标悬停它会告诉你还能传别的参数，不过先这样。"
> —— p020 [03:08]

> "接下来创建 collection。我先放个名字，叫 `test_collection`。文档里说可以 `client.create_collection`。但我要用另一个函数，做点不一样的事：我用 `get_or_create_collection`。如果你机器上已经有叫 `test_collection` 的 collection，它就会直接复用/覆盖。"
> —— p020 [03:37]

> "接下来定义一些文本文档，好看到实际效果。我已经有了，你们也会拿到全部内容。这是一个字典，本质上是文档集合：ID 是 `doc1`、`doc2`、`doc3`，每个文档有 text 字段，里面有些文本。比如查询 `hello world`，这就是我们要传进 Chroma 数据库的查询，然后 Chroma 会做我们讲过的事——生成一个小 embedding，进去找最相似的文档。"
> —— p020 [04:07]

> "在定义查询之前，先把这些文档加进 collection，因为现在 collection 本质上就是一张表，我们要往里加文档。用 `collection.add`。但 `.add` 的问题是，因为我们会反复运行，它会不停地重复加同样的文档。所以还有另一个方法叫 `upsert`，它能保证即使反复运行也不会重复添加同一文档。所以用这个很重要。"
> —— p020 [05:03]

> "因为我们有不同文档，这里就 1、2、3 三条，我把它放进一个循环里，通过循环来加。我说 `for document`，简单点叫 `doc`，然后不用 `add`，用 `upsert`，把文档 ID 传进去——每次循环取出 doc 的 ID，也就是 doc1、doc2、doc3，然后 text 字段取 doc 的 text。"
> —— p020 [05:31]

> "现在定义好查询文本了。接下来跑 `collection.query`，把查询传进去。我说 `results`，用 collection 调 `query`。可以传几个参数，我们有 query_text，可以传不止一个文本。我们走 `query_text`，传第一个查询，就是那个 query text，比如 `hello there`。然后传我们想拿回的结果数，我说 `n`，这是字段参数，我们取 3 个。"
> —— p020 [06:30]

> "现在打印 results 看看会发生什么。保存，运行 `python3 app.py`。会花一点时间，因为它要做该做的事。"
> —— p020 [07:53]

> "报了个错，看起来我犯了个错误。参数 `texts`——这里必须是 `documents`。这是另一点我们要非常注意的：这里必须传文档的列表。回到文档看，字段是 `documents`，因为可以传不止一个，然后还有 IDs。我们这里就是这么做的，只不过是在循环里做。"
> —— p020 [07:53]

> "好，我们看到拿到了所有文档的结果、所有 ID：doc1、doc2、doc3。还有距离（distances），你能看到 0.0、0.01，然后另一个距离、又一个距离。然后是实际文档内容。`hello world` 这里距离是 0.0，说明这是最相似的结果。因为文档一是 `hello world`，我们传的查询也是 `hello world`，所以距离是 0，也就是最相似。越接近 0 越相似，数字越大越不相似。"
> —— p020 [08:21]

> "这就对了，东西跑起来了。下一讲我们会再拆解一下，也许让它更好看一点，但你看，它确实在工作。"
> —— p020 [09:20]

---

## 3. 从零复现

### 3.1 前置：装好三样东西（P17–P18）

讲师在 P17 明确列出三件必须准备好的东西，缺一不可：

1. **VS Code**（代码编辑器）
2. **Python**（装在机器上，能跑）
3. **OpenAI 账号 + API Key**

P18 里讲师演示了怎么装：

- **VS Code**：Google 搜 "VS Code"，点第一个链接，按你的系统下载（Windows 显示 "Download for Windows"，Mac 显示 "Download Mac Universal"），下载后双击安装。
- **Python**：Google 搜 "Python setup"，点 "Download Python"（讲师录制时页面显示的是 Python 3.12.4，讲师强调「你看到时版本可能不同，没关系」）。Windows 用户按页面上的 Windows 安装说明下载对应安装包，双击可执行文件走完流程。装完后可以看 Python 官方文档里的 "Python Setup and Usage" 章节，里面有 Windows 和 Mac 的完整安装步骤。
- **OpenAI 账号 + API Key**：去 OpenAI 登录/注册（可以用 Google / Microsoft / Apple 账号，也可以邮箱注册）。登录后进入 **API** 区域（不是 ChatGPT 聊天区），点 **API keys**，点 **Create new secret key**，可以选 owned by you 或 service account（讲师说「都行」），给 key 起个名字，选权限，点创建。**创建后立刻复制并保存到安全的地方，不要分享给任何人**——讲师特别强调这一点。

> 注意：P20 里实际写代码时**并没有用到 OpenAI API Key**。ChromaDB 的 `chromadb.Client()` 默认自带一个本地 embedding 函数（课里没讲具体是哪个模型），所以第一个脚本不需要联网调 OpenAI。API Key 是为后面课程准备的。这一点逐字稿没有明说，但从 P20 的代码可以确认——脚本里没有任何 OpenAI 调用。

### 3.2 建项目目录

在你想放项目的地方新建一个空文件夹，比如 `chroma-demo`，用 VS Code 打开它（File → Open Folder）。讲师在 P20 开头说「我打开了 Visual Studio，是空的，没有任何文件」，然后右键新建 `app.py`。

### 3.3 创建并激活虚拟环境（P20 [00:53]–[02:15]）

在 VS Code 的集成终端里，**在项目根目录下**执行：

**macOS / Linux：**

```bash
python3 -m venv venv
source venv/bin/activate
```

**Windows（讲师口述的写法）：**

```bat
python -m venv myenv
myenv\Scripts\activate
```

讲师原话是 Windows 上用 `python` 或 `py` 加 `-m venv`，名字随便叫（他举例 `myenv`），激活时进到 `myenv\Scripts` 目录调用 `activate`。激活成功后终端提示符前面会出现 `(venv)` 或 `(myenv)`。

> 讲师强调：「确保虚拟环境已激活。」后面所有 `pip install` 和 `python` 命令都必须在这个激活状态下执行，否则包装到全局去了。

### 3.4 安装依赖（P20 [02:15]）

```bash
pip install chromadb
```

讲师没有指定版本号，逐字稿里也没有出现版本号。**课里没讲具体版本**，装最新版即可。装完后在 VS Code 里如果 `import chromadb` 下面有波浪线，按讲师的做法：**选中解释器（Python: Select Interpreter），选虚拟环境里的那个 Python**（P20 [02:43]）。

### 3.5 写 `app.py`（P20 [03:08]–[07:53]）

按讲师的操作顺序，文件里依次是：

1. `import chromadb` 和 client 相关导入
2. `chromadb.Client()` 创建客户端
3. `get_or_create_collection(name="test_collection")` 创建/复用 collection
4. 定义一个文档字典：`doc1` / `doc2` / `doc3`，每个有 `text` 字段
5. 用 `for` 循环遍历文档，调 `collection.upsert(...)` 逐条插入（**不是 `add`**，讲师明确说 `upsert` 才能避免重复运行导致重复插入）
6. 定义查询文本（讲师举例 `hello world`，后面 query 时又提到 `hello there`，见下方说明）
7. `collection.query(query_texts=[...], n_results=3)`
8. `print(results)`

**关于查询文本的不一致**：讲师在 P20 [04:33] 说「比如查询 `hello world`，这就是我们要传进 Chroma 数据库的查询」，在 [06:59] 又说「传第一个查询，就是那个 query text，比如 `hello there`」。逐字稿里两处措辞不同，无法确定他最终用的确切字符串。**复现时用 `hello world` 即可**——因为 [08:50] 他解释结果时说「文档一是 `hello world`，我们传的查询也是 `hello world`，所以距离是 0」，这说明最终跑通的那次查询词就是 `hello world`。

**关于第一次报错**：讲师第一次运行时把参数写成了 `texts`，报错后改成 `documents`。这是 `collection.upsert` 的参数名问题——正确参数名是 `documents`（复数，因为要传列表）。第 4 节的完整代码直接用正确写法，并在第 5 节解释这个坑。

### 3.6 运行（P20 [07:53]）

```bash
python3 app.py
```

Windows 上如果 `python3` 不可用，用 `python app.py`。

预期输出（讲师屏幕上看到的）：一个字典，包含 `ids`（doc1、doc2、doc3）、`distances`（第一个是 0.0，后面是 0.01 和另一个数）、`documents`（三条文本）。**具体字段名以你实际输出为准**——ChromaDB 不同版本返回结构可能略有差异，讲师屏幕上看到的是 `ids` / `distances` / `documents` 这几类信息。

---

## 4. 完整代码

> 说明：逐字稿里讲师是边讲边敲、并且有复制粘贴（「我复制这些」「我已经有了，你们也会拿到全部内容」），所以**逐字稿没有给出完整源码**。下面是按他口述的每一步**还原**出的完整可运行文件。文档文本内容逐字稿只念了 `hello world` 和 `hello there` 两处，其余两条文档的具体文字**课里没讲**，这里用占位文本填充，并在注释里标明。你可以换成任意文本，不影响运行。

**文件路径：`chroma-demo/app.py`**

```python
# app.py
# 依赖：pip install chromadb
# 运行：python3 app.py（Windows 用 python app.py）
# 运行前确保虚拟环境已激活

import chromadb
from chromadb import Client

# 1) 创建 ChromaDB 客户端
#    讲师原话：通过调用 chromadb.Client() 创建客户端
#    默认是内存模式，进程结束数据就没了（课里没讲持久化配置）
client = chromadb.Client()

# 2) 创建或复用 collection
#    讲师用的是 get_or_create_collection，不是 create_collection
#    这样重复运行不会因为 collection 已存在而报错
collection = client.get_or_create_collection(name="test_collection")

# 3) 定义文档
#    doc1 的文本逐字稿明确是 "hello world"
#    doc2 / doc3 的具体文本课里没讲，这里用占位文本，可自行替换
documents = {
    "doc1": {"text": "hello world"},
    "doc2": {"text": "hello there, how are you today"},
    "doc3": {"text": "this is a third document about vector databases"},
}

# 4) 逐条插入文档
#    讲师强调：用 upsert 而不是 add
#    add 会在重复运行时不断重复插入同一文档
#    upsert 保证同一 ID 不会重复
#    注意参数名是 documents（复数，传列表），不是 texts
for doc_id, doc in documents.items():
    collection.upsert(
        ids=[doc_id],
        documents=[doc["text"]],
    )

# 5) 定义查询文本
#    讲师最终跑通时用的是 "hello world"（与 doc1 相同，所以 distance 为 0）
query_text = "hello world"

# 6) 执行查询，取回 3 条结果
#    query_texts 传列表（可以传多个查询）
#    n_results 是返回条数
results = collection.query(
    query_texts=[query_text],
    n_results=3,
)

# 7) 打印结果
print(results)
```

**运行命令：**

```bash
# macOS / Linux
python3 -m venv venv
source venv/bin/activate
pip install chromadb
python3 app.py
```

```bat
:: Windows
python -m venv myenv
myenv\Scripts\activate
pip install chromadb
python app.py
```

**预期输出结构（讲师屏幕上看到的形态，字段名以实际为准）：**

```
{
  'ids': [['doc1', 'doc2', 'doc3']],
  'distances': [[0.0, 0.01..., ...]],
  'documents': [['hello world', '...', '...']],
  ...
}
```

讲师在 [08:50] 明确说：`doc1` 的 distance 是 0.0，因为查询词和文档文本都是 `hello world`；**越接近 0 越相似，数字越大越不相似**。

---

## 5. 逐行解释

### 5.1 概念部分：为什么先讲 LLM（P15）

在写任何向量数据库代码之前，讲师花了整整一讲讲 LLM，原因是：**向量数据库存在的意义就是给 LLM 提供上下文**。P19 的工作流图里，最上面是 App 层，中间是 LLM 上下文窗口，最下面是 ChromaDB——三者是一条链。不理解 LLM 怎么「理解」文本，就理解不了为什么要把文本转成 embedding。

讲师对 LLM 的定义拆成几个关键词，逐个对应：

- **「算法」**：LLM 不是数据库、不是搜索引擎，是一个在海量数据上训练出来的算法。
- **「训练前先有数据收集」**：文本为主，有时也有音频、图像。这些数据让模型具备「核心知识」。
- **「两步训练」**：先**无监督学习**（学词与概念之间的关系），再**有监督学习 + 微调**。讲师没有展开微调的具体方法，课里没讲。
- **「Transformer」**：基于神经网络的技术，负责分析输入文本、理解上下文、语义、甚至语言细微差别。讲师用「大脑—神经元—连接」做类比。
- **「self-attention（自注意力）」**：这是 Transformer 里最关键的一层。讲师用翻译举例：把葡萄牙语翻成英语时，编码器接收输入、切分、分析，解码器输出译文；而编码器和解码器**各自都有自注意力层**，解码器还多一层**编码器-解码器注意力**（讲师说「不用深入」）。自注意力的作用是「解码并观察词与词之间的关系」，帮解码器聚焦到输入句子里相关的部分，理解整句语义。
- **「上下文」**：讲师反复强调的关键词——Transformer 捕捉词间关系、理解上下文，「就像你我对话或阅读时能理解上下文一样」。

这一段对前端转 AI 应用工程师的意义：你以后写 RAG（检索增强生成）时，`embedding` 就是 Transformer 把文本压成的向量，`相似度` 就是向量之间的距离。P20 里 distance 越接近 0 越相似，就是这套机制的工程化体现。

### 5.2 `chromadb.Client()`

讲师原话：「通过调用 `chromadb.Client()` 创建了 ChromaDB 客户端。鼠标悬停它会告诉你还能传别的参数，不过先这样。」——所以这里**不传任何参数**。课里没讲持久化（`PersistentClient`）怎么配，也没讲服务端模式，第一个脚本就是内存模式。

### 5.3 `get_or_create_collection` 而不是 `create_collection`

讲师明确说文档里可以 `client.create_collection`，但他**故意换成了 `get_or_create_collection`**，理由是：「如果你机器上已经有叫 `test_collection` 的 collection，它就会直接复用/覆盖。」这对反复调试很关键——用 `create_collection` 第二次运行会因为同名 collection 已存在而报错。

> 前端类比：这就像 `localStorage.getItem(key) ?? 初始化` 的写法，幂等。

### 5.4 文档字典的结构

讲师说「这是一个字典，本质上是文档集合：ID 是 `doc1`、`doc2`、`doc3`，每个文档有 text 字段」。所以结构是 `{ "doc1": {"text": "..."}, ... }`。逐字稿只念了 `doc1` 的 `hello world`，另外两条的具体文字课里没讲。

### 5.5 `upsert` 而不是 `add`——这是本段最重要的工程细节

讲师花了近 30 秒解释这一点，必须原样保留：

> "`.add` 的问题是，因为我们会反复运行，它会不停地重复加同样的文档。所以还有另一个方法叫 `upsert`，它能保证即使反复运行也不会重复添加同一文档。所以用这个很重要。"

这是**幂等性**问题。`add` 是纯插入，`upsert` 是「存在则更新、不存在则插入」。在开发阶段你会反复 `python3 app.py`，用 `add` 的话 collection 里会堆满重复的 doc1/doc2/doc3，查询结果全是重复项。用 `upsert` 就安全。

> 前端类比：`add` 像 `array.push()`，`upsert` 像 `Map.set(key, value)`——同一个 key 不会产生第二条。

### 5.6 为什么用 `for` 循环逐条插入

讲师说「因为我们有不同文档，这里就 1、2、3 三条，我把它放进一个循环里，通过循环来加」。注意：ChromaDB 的 `upsert` 其实支持一次传多个 ID 和多个文档（参数是列表），但讲师选择了循环逐条插。这是他的写法选择，不是 API 限制。复现时按他的写法即可。

### 5.7 参数名必须是 `documents` 不是 `texts`——第一次报错的坑

讲师第一次运行报错，原话：

> "报了个错，看起来我犯了个错误。参数 `texts`——这里必须是 `documents`。这是另一点我们要非常注意的：这里必须传文档的列表。"

所以 `collection.upsert(ids=[...], documents=[...])`，**参数名是 `documents`（复数）**，值必须是**列表**（因为可以一次传多条）。同理 `query` 用的是 `query_texts`（也是复数、也是列表）。这两个参数名容易混，记住：**插入用 `documents`，查询用 `query_texts`**。

### 5.8 `query_texts` 和 `n_results`

讲师说：「我们走 `query_texts`，传第一个查询……然后传我们想拿回的结果数，我说 `n`，这是字段参数，我们取 3 个。」

- `query_texts`：列表，可以传多个查询（讲师说「可以传不止一个文本」）。
- `n_results`：返回条数，讲师取 3（因为一共就 3 条文档）。

### 5.9 怎么读结果：distance 的含义

讲师在 [08:50] 解释得最清楚：

> "`hello world` 这里距离是 0.0，说明这是最相似的结果。因为文档一是 `hello world`，我们传的查询也是 `hello world`，所以距离是 0，也就是最相似。越接近 0 越相似，数字越大越不相似。"

这是整段课第一次让你**亲眼看到向量相似度的数值表现**。P19 讲的理论（「基于向量距离、度量做相似度比较和检索」）在这里落地成一个 `0.0`。

### 5.10 P19 工作流图：把整条链路串起来

讲师在 P19 反复说「你应该经常回来看这张图」。把它拆成 5 步（讲师自己在 [04:18] 也总结了）：

1. **用户提交查询**到 App 层。
2. **App 为查询生成 embedding**（讲师说可以用 OpenAI 的 embedding，后面课程会讲；P20 的脚本里没用到，用的是 Chroma 默认的）。
3. **查询 embedding 和 Chroma 里已有 embedding 比较**，找出相关文档。
4. **相关结果 + 查询一起喂给 LLM 上下文窗口**，LLM 处理并生成答案。
5. **答案返回给用户**。

讲师强调这套架构相对传统关键词搜索的优势：**上下文相关、语义丰富**，能处理复杂查询。这就是「语义搜索」和「关键词搜索」的本质区别——前者比的是向量距离，后者比的是字符串匹配。

---

## 6. 复现检查清单

按顺序打勾，任何一步失败就停在那里排查：

- [ ] VS Code 已安装并能打开文件夹
- [ ] `python3 --version`（Windows `python --version`）能输出版本号
- [ ] 已注册 OpenAI 账号，已在 API keys 页面创建过 key 并保存好（P20 脚本本身不需要它，但后面课程需要）
- [ ] 项目文件夹已建好，VS Code 已打开该文件夹
- [ ] 终端里执行 `python3 -m venv venv` 成功，目录下出现 `venv/` 文件夹
- [ ] `source venv/bin/activate`（Windows `myenv\Scripts\activate`）后，终端提示符前出现 `(venv)`
- [ ] `pip install chromadb` 成功，无报错
- [ ] VS Code 里 `import chromadb` 下方**没有**波浪线（有的话：Cmd/Ctrl+Shift+P → Python: Select Interpreter → 选 `venv` 里的 Python）
- [ ] `app.py` 已按第 4 节完整写入
- [ ] `python3 app.py` 能跑完，终端打印出包含 `ids`、`distances`、`documents` 的字典
- [ ] 输出里 `doc1` 对应的 distance 是 `0.0`（或极接近 0）
- [ ] 再运行一次 `python3 app.py`，结果条数**没有翻倍**（验证 `upsert` 生效）
- [ ] 把 `query_text` 改成 `"hello there"` 再跑，`doc2` 的 distance 应该变小、`doc1` 的 distance 应该变大（验证语义相似度确实在工作）

---

## 7. 课里没讲但你会撞上的

1. **ChromaDB 的版本**。讲师全程没提版本号，`pip install chromadb` 装的是当时最新版。不同版本 `query` 返回的字段结构可能不同（比如是否包含 `embeddings`、`metadatas`）。**以你实际输出为准**，不要拿讲师的输出逐字段对。

2. **默认 embedding 函数是什么**。P20 的脚本没有显式指定 embedding 函数，`chromadb.Client()` 会用内置的默认 embedding。讲师在 P19 说「我们可以用 OpenAI 的 embedding，后面会看到」，但 P20 没用。默认用的是哪个模型、要不要下载、第一次运行会不会卡在下载模型上——**课里没讲**。如果你第一次运行特别慢，大概率是在下载默认 embedding 模型。

3. **数据持久化**。`chromadb.Client()` 是内存模式，脚本一结束数据就没了。每次运行都是全新的。讲师没讲 `PersistentClient`，也没讲数据存哪。如果你想要数据留下来，需要自己查文档换 client 类型——**课里没讲**。

4. **`get_or_create_collection` 的「覆盖」语义**。讲师说「如果已有同名 collection，就会直接复用/覆盖」。实际行为是**复用**（返回已有 collection），不是清空重建。所以如果你改了 `documents` 字典里的文本但 ID 不变，`upsert` 会更新对应 ID 的内容；如果删了某个 ID，旧数据**不会**自动消失。这一点讲师没展开。

5. **Windows 激活脚本的路径分隔符**。讲师口述是「进到 `myenv` 里的 `Scripts` 目录调用 `activate`」，实际命令是 `myenv\Scripts\activate`（反斜杠）。PowerShell 下如果报「无法加载文件，因为在此系统上禁止运行脚本」，需要先执行 `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`——**课里没讲**，但 Windows 用户大概率会撞上。

6. **`python3` vs `python`**。macOS/Linux 上讲师用 `python3`，Windows 上用 `python` 或 `py`。如果你在 Windows 上敲 `python3` 提示找不到命令，换成 `python`。

7. **P16 是纯插播**。P16 整段是讲师请求评价、引导去 discussion board 提问，没有任何技术内容。复现时直接跳过，不影响任何步骤。

8. **P15 的 LLM 列表**。讲师列举了 GPT-3.5、GPT-4、Llama、Bloom、FlanUL2、ChatGPT，并开玩笑说「也许你看的时候已经有 GPT-110 了」。这些只是举例，不涉及任何安装或调用，知道即可。

9. **`n_results` 超过文档总数**。脚本里 `n_results=3` 而文档正好 3 条。如果你把文档减到 2 条但 `n_results` 还是 3，ChromaDB 的行为（报错还是返回 2 条）**课里没讲**，实际以你跑的版本为准。

10. **前端视角的对应关系**（帮你迁移知识）：`collection` ≈ 一张表 / 一个 `Map`；`upsert` ≈ `Map.set`；`query` ≈ 带排序的 `filter`，排序键是向量距离；`distance` ≈ 排序分数，越小越靠前。整条 P19 工作流 ≈ 「用户输入 → 调 embedding API 拿向量 → 向量库检索 top-k → 把 top-k 文本拼进 prompt → 调 LLM → 返回」，这就是最朴素的 RAG 骨架。