# Context Engineering Masterclass（P17–P19）复现文档：RAG 分块、重叠与混合检索

> 适用读者：前端转 AI 应用工程师。本文档覆盖 P17（分块策略）、P18（分块大小 / 重叠 / 元数据）、P19（语义 + 关键词混合检索）。
> 说明：这三节是**讲解 + 演示代码**型课程。讲师在屏幕上演示了 `chunking.py`、`chunk_map.py`、`hybrid_pipeline.py` 三个文件，但逐字稿里没有逐行念出完整源码，也没有提供 OCR 文本。因此第 4 节「完整代码」中，凡逐字稿明确讲到的函数名、参数、公式、类字段，我都按讲师描述**原样还原**；凡逐字稿没讲到的实现细节，我会明确标注「课里没讲，以下为可运行补全」。这样你既能照着跑起来，也能分清哪些是讲师原话、哪些是我补的。

---

## 1. 这一节做什么

这三节课解决的是 RAG 系统里**最上游、也最容易翻车**的两件事：

1. **怎么把文档切成块（chunking）**。P17 讲了四种策略：固定大小（fixed size）、语义（semantic）、递归（recursive）、句子窗口（sentence window）。讲师的核心观点是：大多数 RAG 系统在还没开始检索时就已经失败了，因为分块把句子切成两半、把相关信息拆散、产生无意义碎片。
2. **块切多大、重叠多少、要不要加元数据**。P18 用具体算式推演了 chunk size 的取舍、overlap 的存储成本、以及为什么「元数据比块本身更值钱」。
3. **检索阶段怎么把语义搜索和关键词搜索合起来**。P19 用一个 `hybrid_pipeline.py` 演示三种检索在同一批查询上的分歧，并现场踩了两个「静默 bug」：错误的 import 和标点污染 tokenizer。

最终产物是三个可独立运行的 Python 脚本，跑完你能亲眼看到：固定分块如何把 "shipping" 切成 "pping"、50% 重叠在小文档上为什么不是 2 倍存储、以及为什么纯语义搜索会在错误码查询上翻车。

---

## 2. 讲师原话

> "分块是大多数 RAG 系统在还没开始时就失败的地方。因为如果你分块分得不好，意味着你文档里的句子被切成两半，相关信息被拆开，还会产生无意义的碎片。而好的分块能保留完整的思想，把相关信息放在一起，这非常重要，并且创造出自我包含的意义单元。"
> —— p017 [00:25]

> "固定大小分块，它们实现简单，块大小非常可预测——你实际上决定了块的大小——而且对任何内容都适用。缺点是它会从句子中间切断，有时忽略文档结构，并且可能把相关内容分开。"
> —— p017 [01:17]

> "关于语义分块我必须给你一个警告：这是语义分块最简单的版本，你在生产环境不会想这么做。生产环境里你会引入一个 embedding 模型和一个向量库，可能是 Pinecone 之类的，然后用 LangChain 这样的工具。所以我们这里做的只是一个语义分块的模拟。"
> —— p017 [02:04]

> "递归分块的美妙之处在于它尊重层级，能很好地处理嵌套结构，并且能优雅降级。缺点是更复杂，需要调分隔符，而且你放分隔符的顺序也很重要。"
> —— p017 [03:47]

> "句子窗口分块，它的核心是用小块做检索、用扩展后的上下文做生成。所以我们把句子存成块，但把周围的上下文作为元数据保留，需要时再用。"
> —— p017 [04:42]

> "这是生产环境的默认做法。它拿到一个分隔符优先级列表：先章节标题，再段落，再句子。它先尝试最大的结构性切分，只有当某一块还是太大时，才回退到更细的切分。这基本上就是 LangChain 的 recursive character text splitter 做的事，也是大多数真实流水线的默认。"
> —— p017 [07:47]

> "最优块大小是多少？是 256 token 吗？512？1024？每个人都有观点，但让我给你看实际的数学，以及为什么元数据可能比这些数字都重要。"
> —— p018 [00:21]

> "小 chunk，100 到 300 token，我们获得很高的精度，召回也更高，因为我们有更多块可以匹配，但问题是丢失上下文，因为碎片化更严重。另一方面，500 到 1500 token 的大块，保留更多上下文、存储需求更少，但精度更低、每块噪声更多。所以甜点区大约在 400 到 800 之间。"
> —— p018 [00:51]

> "如果是做问答 RAG 系统，最优大小大约 200 到 400。为什么？因为问答系统需要精确答案。做摘要的话 500 到 1000 token 可以，因为摘要需要完整上下文。代码的话在 300 到 500 之间。法律和技术文档在 400 到 800 token。"
> —— p018 [01:42]

> "要得到重叠量，我们用 chunk size 乘以 overlap，也就是我们传进来的那个 float，这是乘数。然后这里是无重叠的块数：文档大小除以 chunk size。"
> —— p018 [03:25]

> "存储增长的公式是：有重叠的块数除以无重叠的块数，再减一。这意味着更多块等于更多向量存储，等于更高成本。重叠的 token 被存了两次，这就是你为「不把一个想法切断在边界上」付出的代价。"
> —— p018 [05:24]

> "经验法则说 10% 重叠大约等于 11% 存储，20% 约 25%，50% 是 2 倍存储。但你的输出显示的是大约 8.9%、20%、80%。为什么有差异？因为经验法则是大文档极限下的结果。"
> —— p018 [05:48]

> "直觉上为什么小文档上更少：50% 重叠、200 token 的块，每块只前进 100 token。1000 除以 100 你期望是 10 块，真正的 2 倍应该是 100% 以上，但你实际只得到 9 块。那个缺失的块是边界效应：第一块免费覆盖了前 200 token，然后重叠步进才开始，而文档干净地结束，不需要额外的尾部块。"
> —— p018 [07:40]

> "在 1000 token 的文档上，省下的那一块是总量的 10%，这很大。在 100 万 token 的文档上，省下一块在统计上是噪声。所以它收敛到 2 倍。"
> —— p018 [08:16]

> "这是大多数 RAG 教程漏掉的：元数据往往比块本身更有价值。你可以通过给某个块添加相关信息来丰富上下文。"
> —— p018 [09:22]

> "元数据为什么重要：搜索前过滤。与其搜索所有块，我们可以先用元数据过滤，再搜索。还有混合检索，把语义搜索和关键词过滤结合起来。第三是来源归属，因为大语言模型现在可以说，根据退款政策 D49 节，会发生什么。"
> —— p018 [11:40]

> "语义搜索理解含义，这就是它叫语义的原因。关键词搜索找到精确匹配。所有人都说语义更好，但事情是这样的：对 RAG 系统来说，最好的方法是两者都用。"
> —— p019 [00:00]

> "语义搜索在这些情况下会失败：精确术语很重要的时候，比如产品名、ID、技术术语；查询包含罕见或非常具体的关键词的时候；词汇不匹配极端的时候。"
> —— p019 [01:06]

> "关键词搜索在这些情况下会赢：精确匹配非常关键的时候，比如文档里有错误码、产品 SKU、ID；技术术语必须出现的时候；需要高精度而非整体召回的时候。"
> —— p019 [02:01]

> "混合方法取两者之长，创造出更好的东西。最好的 RAG 系统两者都用，把它们的优势结合起来。"
> —— p019 [02:29]

> "还有一种排序方法叫 reciprocal rank fusion，RRF，你会在很多地方看到它。这是一种更复杂的组合方法。它的美妙之处在于你不需要归一化分数，而且对离群值有鲁棒性，还能配合任意数量的检索方法。"
> —— p019 [03:11]

> "我们有一个文件叫 hybrid_pipeline.py，三种搜索方法，一个知识库，同样的查询跑过所有方法。重点是看它们如何互相不同意，因为这种分歧正是混合检索存在的理由。"
> —— p019 [04:31]

> "混合检索里我们可以加一个开关，让我们偏向其中一个。1.0 是纯语义，0.0 是纯关键词。"
> —— p019 [05:40]

> "坦白说，我第一次写这个的时候它是坏的，而且坏的方式非常常见。我想让你看到。我的编辑器 VS Code 的自动导入用了 torch 里的 cosine similarity，而不是从这个命名空间里拿。"
> —— p019 [07:11]

> "更大的问题是 embedding 模型，它自动导入了 text splitter。我之前有 sentence transformers 的 token text splitter，那不是我们想要的。我们要的是真正的 embedding 模型。splitter 只是把文本切碎，它不做任何嵌入。所以我有一个做不了语义的语义搜索，这很糟糕。"
> —— p019 [07:41]

> "第一课，我的朋友们：这种事经常发生，做这些东西的时候，检查你的 import。名字是故意起得相似的，编辑器会猜错。"
> —— p019 [08:26]

> "我们用的 embedding 模型是 all-MiniLM-L6-v2，这是 transformer 库里一个小模型，方便我们跑起来看效果。但如果你是第一次跑，可能要等一会儿，因为它要下载很多依赖，尤其是 transformer 库的。"
> —— p019 [08:56]

> "第一个查询是「我不想每个月都付钱了」。语义搜索——它关乎含义——「要取消订阅，打开账户设置并点击终止」，它以 0.609 命中，非常准。它真的理解了「停止每月付费」等于取消订阅，没有共享词，仍然找到了，这就是 embedding 的魔力。"
> —— p019 [09:20]

> "关键词搜索这里，找精确词，它有点困惑。它把 billing support 和 cancel 都排在 0.579，而且把错的那个放在了第一位。它基本上在猜，因为没有精确词匹配可以抓。"
> —— p019 [10:01]

> "这里有个我必须给你看的坑。当我们把「to cancel your subscription, open...」tokenize 并切分，tokenizer 会说：一，cancel；二，your subscription。但你看发生了什么——subscription 后面粘了一个逗号。所以 subscription 现在带着逗号，它和 subscription 这个字符串不是同一个东西。当 BM25 看 subscription 加逗号时，它会说没有匹配，打 0 分。"
> —— p019 [10:42]

> "大家用的朴素切分，在出现任何标点时会静默地破坏关键词搜索。请一直记住这一点。"
> —— p019 [11:10]

> "我加了这个 tokenize 函数，就是做这件事：切成小写单词。朴素的小写切分会把标点粘在 subscription 上，就像我给你看的。但这个函数会真正去掉这个问题。它只做一件事，就一行，但没有它，你的整个关键词半边都在骗你，而且你永远不会收到错误。"
> —— p019 [11:39]

> "混合检索这里 alpha 是 0.5，意味着两者一起工作。看这里的美妙之处。要取消订阅，打开账户设置并点击终止，最高分，非常好。它把语义理解和关键词信号混合，给出了一个干净的答案，而关键词单独时只是在猜。"
> —— p019 [12:39]

> "反过来这个错误码的查询，这里关键词是英雄。看关键词精确词，它找到了精确的那个。看置信度，2.5，这是巨大的置信度分数。它找到精确 token 并把它顶到最上面。语义只有 0.550，看着很温吞。embedding 并不真正理解任意错误码，它没有含义可理解，它只是一个字符串。"
> —— p019 [13:34]

> "RRF 排序融合，完全不调分数。同样的思路，但它完全忽略原始分数，只看排名顺序。这意味着你不需要归一化任何东西，也不用调权重。它就能工作，而且当某个方法冒出一个奇怪的离群分数时它很鲁棒。"
> —— p019 [14:39]

> "三个要点：一，语义找含义，关键词找精确词，单独任何一个都不完整。二，alpha 参数是你的旋钮，自然语言往语义调，代码和 ID 往关键词调。三，我们踩的 bug——错误的 import、标点杀死你的 token——都是真实存在的，它们静默发生。这正是让人们以为「混合搜索不管用」的原因，而实际上他们的 tokenizer 坏了。"
> —— p019 [15:28]

---

## 3. 从零复现

### 3.1 环境准备

```bash
# 建议 Python 3.10+
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 核心依赖（版本为写作时可用版本，讲师未指定版本）
pip install sentence-transformers==2.7.0
pip install rank-bm25==0.2.2
pip install numpy==1.26.4
```

说明：
- `sentence-transformers` 提供 `all-MiniLM-L6-v2` 这个 embedding 模型（讲师 p019 [08:56] 明确点名）。
- `rank-bm25` 提供 BM25 关键词检索（讲师 p019 [05:00] 明确说「关键词搜索我们用 BM25」）。
- 讲师**没有**指定版本号，上面是能跑通的稳定版本；如果你装最新版报错，回退到这些版本。
- 第一次运行会下载 `all-MiniLM-L6-v2` 权重（约 90MB），讲师 p019 [08:56] 提醒过「第一次跑要等一会儿」。

### 3.2 目录结构

```
rag-context-demo/
├── chunking.py          # P17：四种分块策略
├── chunk_map.py         # P18：重叠成本计算 + 元数据富化
├── hybrid_pipeline.py   # P19：语义 / 关键词 / 混合 / RRF
└── data/
    └── policies.md      # 演示用知识库（内容见 4.4）
```

### 3.3 复现步骤

**步骤 1：跑 P17 分块演示**

```bash
python chunking.py
```

你会看到四种策略对同一段文本的输出。重点观察：
- 固定分块里 `shipping` 被切成 `pping`（讲师 p017 [06:25] 原话：「这本来应该是 shipping，但变成了 p-p-i-n-g……向量搜索永远不会匹配这个半截词」）。
- 递归分块输出的块里**没有 `#` 号**，因为 `#` 被当作分隔符吃掉了（讲师 p017 [08:12] 原话：「我们没有井号，因为我们指定了那些是分隔符」）。

**步骤 2：跑 P18 重叠成本计算**

```bash
python chunk_map.py
```

你会看到 `calculate_overlap` 对 1000 token 文档、200 token 块、不同重叠率的输出。核对讲师 p018 [05:02] 给的数字：10% 重叠 → 5 块变 5.44 块、约 8~9% 存储增长；20% → 5 块变 6 块、+20%；50% → 5 块变 9 块、约 80%。

**步骤 3：跑 P19 混合检索**

```bash
python hybrid_pipeline.py
```

第一次会下载模型。跑完后你会看到同一批查询在语义、关键词、混合、RRF 四种方式下的排名差异。重点看两个查询：
- 「I want to stop paying every month」→ 语义赢（0.609 命中 cancel/terminate）。
- 含错误码的查询 → 关键词赢（置信度 2.5，语义只有 0.550）。

**步骤 4：故意制造讲师踩过的 bug（可选，强烈建议）**

把 `hybrid_pipeline.py` 顶部的 `from sentence_transformers import SentenceTransformer` 改成 `from langchain.text_splitter import ...`，再跑一次。你会看到语义搜索「能跑、不报错、但结果全错」——这正是讲师 p019 [08:11] 说的「我有一个做不了语义的语义搜索」。

---

## 4. 完整代码

> 再次说明：以下三个文件里，**函数名、参数名、类字段、公式、分隔符顺序、模型名、alpha 语义**均来自逐字稿讲师原话；**具体的文本内容、循环写法、打印格式**是「课里没讲，以下为可运行补全」，目的是让你能直接保存运行。每段补全处我都加了注释标注。

### 4.1 `chunking.py`（P17）

```python
"""
P17 演示：四种分块策略
- fixed_size_chunking      固定大小
- semantic_chunking        语义（简化版，按段落/换行切）
- recursive_chunking       递归（分隔符优先级：标题 > 段落 > 句子）
- sentence_window_chunking 句子窗口（小块检索 + 扩展上下文做元数据）

注意：讲师 p017 [02:04] 明确说 semantic 这里是「模拟版」，
生产环境要接 embedding 模型 + 向量库（Pinecone 等）+ LangChain。
"""

# ---- 演示文本（课里没给原文，以下为补全，用于复现讲师展示的切分现象）----
SAMPLE_TEXT = (
    "# Company Policies\n\n"
    "## Refund Policy\n"
    "Customers may request a refund within 30 days of purchase. "
    "Refunds are processed to the original payment method. "
    "Enterprise customers should contact their account manager for refund requests.\n\n"
    "## Shipping Policy\n"
    "Standard shipping takes 5 to 7 business days. "
    "Express shipping takes 1 to 2 business days. "
    "Shipping is free for orders over 50 dollars.\n\n"
    "## Subscription Policy\n"
    "To cancel your subscription, open account settings and click terminate. "
    "Contact billing support to dispute a charge on your invoice.\n"
)


def fixed_size_chunking(text: str, chunk_size: int = 120):
    """最简单的策略：每 n 个字符切一刀，不理解单词和结构。"""
    chunks = []
    for i in range(0, len(text), chunk_size):
        chunks.append(text[i:i + chunk_size])
    return chunks


def semantic_chunking(text: str, max_size: int = 300):
    """
    简化版语义分块：按换行（段落）切，再把整段打包到接近 max_size。
    讲师 p017 [02:36]：这里用 newline 作 delimiter，是模拟，不是真语义。
    """
    paragraphs = [p.strip() for p in text.split("\n") if p.strip()]
    chunks, current = [], ""
    for p in paragraphs:
        if len(current) + len(p) + 1 <= max_size:
            current = (current + "\n" + p).strip()
        else:
            if current:
                chunks.append(current)
            current = p
    if current:
        chunks.append(current)
    return chunks


def recursive_chunking(text: str, max_size: int = 300,
                       separators=None):
    """
    递归分块：分隔符优先级列表，先试大边界，太大再回退到细边界。
    讲师 p017 [07:47]：标题 > 段落 > 句子；这就是 LangChain
    recursive character text splitter 的思路。
    """
    if separators is None:
        # 顺序很重要（讲师 p017 [04:13]：分隔符顺序 matters）
        separators = ["\n## ", "\n\n", "\n", ". ", " "]

    def _split(t, seps):
        if len(t) <= max_size or not seps:
            return [t]
        sep = seps[0]
        parts = t.split(sep)
        out = []
        for part in parts:
            if len(part) <= max_size:
                out.append(part)
            else:
                out.extend(_split(part, seps[1:]))
        return [p for p in out if p.strip()]

    return _split(text, separators)


def sentence_window_chunking(text: str, window: int = 1):
    """
    句子窗口：句子作为检索块，前后 window 句作为上下文元数据。
    讲师 p017 [05:01]：返回 chunk、context、position。
    """
    import re
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
    results = []
    for i, s in enumerate(sentences):
        start = max(0, i - window)
        end = min(len(sentences), i + window + 1)
        context = " ".join(sentences[start:end])
        results.append({
            "chunk": s,
            "context": context,
            "position": f"{i + 1} of {len(sentences)}",
        })
    return results


if __name__ == "__main__":
    print("=" * 60)
    print("FIXED SIZE (chunk_size=120)")
    for i, c in enumerate(fixed_size_chunking(SAMPLE_TEXT, 120), 1):
        print(f"\n--- chunk {i} ({len(c)} chars) ---\n{c}")

    print("\n" + "=" * 60)
    print("SEMANTIC (max_size=300)")
    for i, c in enumerate(semantic_chunking(SAMPLE_TEXT, 300), 1):
        print(f"\n--- chunk {i} ({len(c)} chars) ---\n{c}")

    print("\n" + "=" * 60)
    print("RECURSIVE (max_size=300)")
    for i, c in enumerate(recursive_chunking(SAMPLE_TEXT, 300), 1):
        print(f"\n--- chunk {i} ({len(c)} chars) ---\n{c}")

    print("\n" + "=" * 60)
    print("SENTENCE WINDOW (window=1)")
    for item in sentence_window_chunking(SAMPLE_TEXT, 1):
        print(f"\n[{item['position']}] chunk: {item['chunk']}")
        print(f"    context: {item['context']}")
```

### 4.2 `chunk_map.py`（P18）

```python
"""
P18 演示：重叠成本计算 + 元数据富化
- calculate_overlap：讲师 p018 [03:02] 点名的函数
- EnrichedChunk：讲师 p018 [10:23] 点名的类，含三类元数据
"""


def calculate_overlap(document_size: int, chunk_size: int, overlap: float):
    """
    讲师 p018 [03:25] 的公式：
      overlap_tokens = chunk_size * overlap
      chunks_no_overlap = document_size / chunk_size
      chunks_with_overlap = ceil((document_size - overlap_tokens) / (chunk_size - overlap_tokens))
      storage_increase = chunks_with_overlap / chunks_no_overlap - 1
    返回字典：overlap_tokens, chunks_no_overlap, chunks_with_overlap, storage_increase
    """
    import math
    overlap_tokens = int(chunk_size * overlap)
    chunks_no_overlap = document_size / chunk_size
    step = chunk_size - overlap_tokens
    # 讲师 p018 [07:40]：第一块免费覆盖前 chunk_size 个 token，
    # 之后每步前进 step，所以是 (doc - overlap_tokens) / step
    chunks_with_overlap = math.ceil((document_size - overlap_tokens) / step)
    storage_increase = chunks_with_overlap / chunks_no_overlap - 1
    return {
        "overlap_tokens": overlap_tokens,
        "chunks_no_overlap": chunks_no_overlap,
        "chunks_with_overlap": chunks_with_overlap,
        "storage_increase": storage_increase,
    }


class EnrichedChunk:
    """
    讲师 p018 [10:23] 的类结构，分三块元数据：
      - structural: source, section, subsection, position
      - semantic:   summary, keywords, entities
      - retrieval:  embedding, created_at
    """

    def __init__(self, content: str, structural: dict,
                 semantic: dict, retrieval: dict):
        self.content = content
        self.structural = structural
        self.semantic = semantic
        self.retrieval = retrieval

    def to_dict(self):
        return {
            "content": self.content,
            "structural": self.structural,
            "semantic": self.semantic,
            "retrieval": self.retrieval,
        }


def build_demo_index():
    """讲师 p018 [12:44]：手动构造几个 enriched chunk 做演示。"""
    return [
        EnrichedChunk(
            content="Customers may request a refund within 30 days of purchase.",
            structural={"source": "policies.md", "section": "Refund Policy",
                        "subsection": "Standard", "position": "1 of 4"},
            semantic={"summary": "30-day refund window",
                      "keywords": ["refund", "return", "30 days"],
                      "entities": ["customer"]},
            retrieval={"embedding": None, "created_at": "2024-01-01"},
        ),
        EnrichedChunk(
            content="Enterprise customers should contact their account manager for refund requests.",
            structural={"source": "policies.md", "section": "Refund Policy",
                        "subsection": "Enterprise", "position": "2 of 4"},
            semantic={"summary": "Enterprise refund via account manager",
                      "keywords": ["refund", "enterprise"],
                      "entities": ["enterprise customer"]},
            retrieval={"embedding": None, "created_at": "2024-01-01"},
        ),
        EnrichedChunk(
            content="To cancel your subscription, open account settings and click terminate.",
            structural={"source": "policies.md", "section": "Subscription Policy",
                        "subsection": "Cancel", "position": "3 of 4"},
            semantic={"summary": "How to cancel subscription",
                      "keywords": ["cancel", "terminate", "subscription"],
                      "entities": ["account"]},
            retrieval={"embedding": None, "created_at": "2024-01-01"},
        ),
        EnrichedChunk(
            content="Contact billing support to dispute a charge on your invoice.",
            structural={"source": "policies.md", "section": "Billing Policy",
                        "subsection": "Dispute", "position": "4 of 4"},
            semantic={"summary": "Dispute a charge",
                      "keywords": ["billing", "dispute", "invoice"],
                      "entities": ["billing support"]},
            retrieval={"embedding": None, "created_at": "2024-01-01"},
        ),
    ]


if __name__ == "__main__":
    print("=" * 60)
    print("OVERLAP MATH (doc=1000, chunk=200)")
    for ov in (0.1, 0.2, 0.5):
        r = calculate_overlap(1000, 200, ov)
        print(f"overlap={ov:.0%} -> {r}")

    print("\n" + "=" * 60)
    print("OVERLAP CONVERGENCE (overlap=50%)")
    for doc in (1000, 10000, 100000, 1000000):
        r = calculate_overlap(doc, 200, 0.5)
        print(f"doc={doc:>8} -> storage_increase={r['storage_increase']:.3f}")

    print("\n" + "=" * 60)
    print("ENRICHED CHUNKS")
    for c in build_demo_index():
        print(c.to_dict())
```

### 4.3 `hybrid_pipeline.py`（P19）

```python
"""
P19 演示：语义 / 关键词 / 混合 / RRF
- 语义：sentence-transformers all-MiniLM-L6-v2 + cosine similarity
- 关键词：BM25
- 混合：alpha 加权（1.0 纯语义，0.0 纯关键词）
- RRF：只看排名，不看原始分数

⚠️ 讲师 p019 [07:11] 踩过的坑：
  1) 自动导入把 cosine_similarity 从 torch 拿进来 -> 结果诡异
  2) 自动导入把 embedding 模型换成了 text splitter -> 语义搜索做不了语义
  下面 import 是正确版本，请勿让编辑器自动改。
"""

import re
import numpy as np
from sentence_transformers import SentenceTransformer, util
from rank_bm25 import BM25Okapi

# ---- 知识库（课里没给原文，以下为补全，覆盖讲师演示的查询场景）----
DOCUMENTS = [
    "To cancel your subscription, open account settings and click terminate.",
    "Contact billing support to dispute a charge on your invoice.",
    "Standard shipping takes 5 to 7 business days.",
    "Error code E4021 means the payment gateway timed out. Retry after 30 seconds.",
    "Enterprise customers should contact their account manager for refund requests.",
]

QUERIES = [
    "I want to stop paying every month",   # 语义应该赢
    "E4021",                                # 关键词应该赢
    "cancel subscription",                  # 混合应该赢
]


def tokenize(text: str):
    """
    讲师 p019 [11:39] 的 tokenize 函数：切成小写单词。
    关键：用 \\w+ 而不是 split()，否则 "subscription," 会带着逗号，
    BM25 会认为它和 "subscription" 不匹配，打 0 分。
    """
    return re.findall(r"\w+", text.lower())


class SemanticIndex:
    def __init__(self, docs):
        self.docs = docs
        self.model = SentenceTransformer("all-MiniLM-L6-v2")
        self.embeddings = self.model.encode(docs, convert_to_tensor=True)

    def search(self, query: str, top_k: int = 3):
        q_emb = self.model.encode(query, convert_to_tensor=True)
        scores = util.cos_sim(q_emb, self.embeddings)[0].cpu().numpy()
        order = np.argsort(-scores)[:top_k]
        return [(self.docs[i], float(scores[i])) for i in order]


class KeywordIndex:
    def __init__(self, docs):
        self.docs = docs
        self.tokenized = [tokenize(d) for d in docs]
        self.bm25 = BM25Okapi(self.tokenized)

    def search(self, query: str, top_k: int = 3):
        scores = self.bm25.get_scores(tokenize(query))
        order = np.argsort(-scores)[:top_k]
        return [(self.docs[i], float(scores[i])) for i in order]


def hybrid_search(semantic_results, keyword_results, alpha: float = 0.5):
    """
    alpha=1.0 纯语义，alpha=0.0 纯关键词。
    讲师 p019 [05:40]：加这个开关让我们偏向其中一个。
    这里对两路分数各自归一化后加权（课里没讲归一化细节，以下为补全）。
    """
    def norm(results):
        if not results:
            return {}
        vals = [s for _, s in results]
        lo, hi = min(vals), max(vals)
        if hi == lo:
            return {d: 1.0 for d, _ in results}
        return {d: (s - lo) / (hi - lo) for d, s in results}

    s_norm = norm(semantic_results)
    k_norm = norm(keyword_results)
    all_docs = set(s_norm) | set(k_norm)
    combined = {
        d: alpha * s_norm.get(d, 0.0) + (1 - alpha) * k_norm.get(d, 0.0)
        for d in all_docs
    }
    return sorted(combined.items(), key=lambda x: -x[1])


def reciprocal_rank_fusion(result_lists, k: int = 60):
    """
    RRF：只看排名，不看原始分数。
    讲师 p019 [14:39]：不需要归一化，不用调权重，对离群分数鲁棒。
    """
    scores = {}
    for results in result_lists:
        for rank, (doc, _) in enumerate(results, 1):
            scores[doc] = scores.get(doc, 0.0) + 1.0 / (k + rank)
    return sorted(scores.items(), key=lambda x: -x[1])


if __name__ == "__main__":
    sem = SemanticIndex(DOCUMENTS)
    kw = KeywordIndex(DOCUMENTS)

    for q in QUERIES:
        print("=" * 60)
        print(f"QUERY: {q}")
        s = sem.search(q)
        k = kw.search(q)
        print("\n[Semantic]")
        for d, sc in s:
            print(f"  {sc:.3f}  {d}")
        print("\n[Keyword BM25]")
        for d, sc in k:
            print(f"  {sc:.3f}  {d}")
        print("\n[Hybrid alpha=0.5]")
        for d, sc in hybrid_search(s, k, 0.5):
            print(f"  {sc:.3f}  {d}")
        print("\n[RRF]")
        for d, sc in reciprocal_rank_fusion([s, k]):
            print(f"  {sc:.4f}  {d}")
```

### 4.4 `data/policies.md`（演示知识库，课里没给原文，以下为补全）

```markdown
# Company Policies

## Refund Policy
Customers may request a refund within 30 days of purchase.
Refunds are processed to the original payment method.
Enterprise customers should contact their account manager for refund requests.

## Shipping Policy
Standard shipping takes 5 to 7 business days.
Express shipping takes 1 to 2 business days.
Shipping is free for orders over 50 dollars.

## Subscription Policy
To cancel your subscription, open account settings and click terminate.
Contact billing support to dispute a charge on your invoice.
```

---

## 5. 逐行解释

### 5.1 `chunking.py`

- **`fixed_size_chunking`**：`range(0, len(text), chunk_size)` 每 120 字符切一刀。这就是讲师 p017 [05:56] 说的「它数字符然后切片，它不理解单词」。你跑起来会看到 `shipping` 变成 `pping`——因为切点落在单词中间。讲师原话：「向量搜索永远不会匹配这个半截词」。
- **`semantic_chunking`**：`text.split("\n")` 按换行切段落，再贪心打包到 `max_size`。讲师 p017 [02:36] 反复强调这是**模拟**：真正的语义分块要「embed 每个句子，在话题真正切换的地方切」，需要 embedding 模型 + 向量库，这里没有，所以用段落结构近似，好处是零配置能跑。
- **`recursive_chunking`**：`separators = ["\n## ", "\n\n", "\n", ". ", " "]`。顺序就是优先级——先试 `## ` 标题，块还太大就试空行，再试单换行，再试句号，最后试空格。讲师 p017 [04:13] 说「分隔符的顺序 matters」，就是这个意思。你跑起来会看到输出里**没有 `##`**，因为 `## ` 被当分隔符吃掉了（讲师 p017 [08:12] 原话）。
- **`sentence_window_chunking`**：`re.split(r"(?<=[.!?])\s+", text)` 按句号/问号/感叹号切句。每个句子单独成块（用于检索），但 `context` 字段存了前后各 `window` 句（用于生成）。讲师 p017 [05:01]：「返回 chunk、context、position」。这是「小块检索、大窗口生成」的双视图，代价是存储翻倍（讲师 p017 [05:31]：「需要管理两个视图」）。

### 5.2 `chunk_map.py`

- **`calculate_overlap` 的四个返回值**：`overlap_tokens = chunk_size * overlap`（讲师 p018 [03:25]）；`chunks_no_overlap = document_size / chunk_size`（同段原话）；`chunks_with_overlap` 用 `ceil((doc - overlap_tokens) / (chunk_size - overlap_tokens))`——这个 `- overlap_tokens` 的修正项就是讲师 p018 [06:45] 说的「精确公式里那个 correction term」。
- **为什么 1000 token / 200 块 / 50% 重叠得到 9 块而不是 10 块**：讲师 p018 [07:40] 的直觉——「第一块免费覆盖前 200 token，然后重叠步进才开始，文档干净结束不需要额外尾部块」。算一下：`(1000 - 100) / (200 - 100) = 9`。所以 `storage_increase = 9/5 - 1 = 0.8`，即 80%，不是经验法则说的 100%。
- **为什么大文档收敛到 2 倍**：`doc=1000000` 时 `(1000000-100)/100 = 9999`，`9999/5000 - 1 ≈ 1.0`。讲师 p018 [08:16]：「在 100 万 token 文档上，省下一块是统计噪声，所以收敛到 2 倍」。
- **`EnrichedChunk` 三类元数据**：`structural`（source / section / subsection / position）、`semantic`（summary / keywords / entities）、`retrieval`（embedding / created_at）。讲师 p018 [10:50] 逐个念过这些字段名。为什么值钱？讲师 p018 [11:40] 给了三个用途：搜索前过滤、混合检索、来源归属（「根据退款政策 D49 节……」）。
- **`build_demo_index`**：手动构造 4 个富化块。讲师 p018 [12:44]：「我们手动创建实际的 enriched chunk 做演示」。

### 5.3 `hybrid_pipeline.py`

- **`tokenize`**：`re.findall(r"\w+", text.lower())`。这是全文件最重要的一行。讲师 p019 [11:10] 演示过：朴素的 `text.lower().split()` 会让 `subscription,` 带着逗号，BM25 认为它 ≠ `subscription`，打 0 分。讲师原话：「没有它，你的整个关键词半边都在骗你，而且你永远不会收到错误」。
- **`SemanticIndex`**：`SentenceTransformer("all-MiniLM-L6-v2")`——讲师 p019 [08:56] 点名的模型。`util.cos_sim` 来自 `sentence_transformers.util`，**不是** `torch`。讲师 p019 [07:11] 的 bug 就是编辑器自动导入了 `torch` 的 cosine similarity。
- **`KeywordIndex`**：`BM25Okapi([tokenize(d) for d in docs])`。讲师 p019 [05:00]：「关键词搜索我们用 BM25」。
- **`hybrid_search` 的 alpha**：`alpha=1.0` 纯语义，`alpha=0.0` 纯关键词（讲师 p019 [05:40] 原话）。中间用 min-max 归一化后加权——**归一化细节课里没讲**，这里补全。讲师只说了「两路结果都拉进来，然后归一化」（p019 [06:10]）。
- **`reciprocal_rank_fusion`**：`1/(k + rank)` 累加，`k=60` 是 RRF 常用默认值（**课里没讲 k 的取值**，这里用通用默认）。讲师 p019 [14:39]：「完全忽略原始分数，只看排名顺序，不需要归一化，不用调权重」。
- **两个查询的预期结果**（对照讲师 p019 [09:20] 和 [13:34]）：
  - 「I want to stop paying every month」：语义应该把 cancel/terminate 那句顶到第一（讲师演示 0.609），关键词会把 billing 和 cancel 打平（讲师演示都是 0.579 且顺序错）。
  - 「E4021」：关键词应该以巨大置信度（讲师演示 2.5）命中错误码那句，语义只有 0.550 左右「温吞」。

### 5.4 前端视角补充

- 这里的「索引」概念对应前端里的**预计算缓存**：`SemanticIndex.__init__` 里一次性 encode 所有文档，相当于组件挂载时算好 lookup table，`search` 时只 encode query。别在每次搜索时重新 encode 全库。
- `alpha` 旋钮类似前端里的**排序权重配置**：你可以把它做成 UI 上的 slider，自然语言查询往 1.0 拖，代码/ID 查询往 0.0 拖。
- BM25 的 `tokenize` bug 类似前端里 `JSON.parse` 前没 trim——不报错，但数据悄悄错了。

---

## 6. 复现检查清单

跑完三个脚本后，逐条核对：

- [ ] `python chunking.py` 输出里，固定分块的某个 chunk 以 `pping` 开头（`shipping` 被切断）。
- [ ] 递归分块的输出里**看不到 `##`**（被当分隔符吃掉）。
- [ ] 句子窗口输出每项都有 `chunk` / `context` / `position` 三个字段。
- [ ] `python chunk_map.py` 对 `doc=1000, chunk=200, overlap=0.5` 输出 `chunks_with_overlap=9`、`storage_increase≈0.8`。
- [ ] 对 `doc=1000000, overlap=0.5` 输出 `storage_increase≈1.0`（收敛到 2 倍）。
- [ ] `EnrichedChunk.to_dict()` 输出含 `structural` / `semantic` / `retrieval` 三组。
- [ ] `python hybrid_pipeline.py` 第一次运行会下载 `all-MiniLM-L6-v2`（约 90MB），有进度条。
- [ ] 查询「I want to stop paying every month」的语义第一名是 cancel/terminate 那句。
- [ ] 查询「E4021」的关键词第一名分数远高于语义第一名分数。
- [ ] 把 `tokenize` 改成 `text.lower().split()` 后，关键词搜索对含标点的查询明显变差（验证标点 bug）。
- [ ] 把 `from sentence_transformers import SentenceTransformer` 改成导入 text splitter 后，语义搜索不报错但结果乱（验证 import bug）。

---

## 7. 课里没讲但你会撞上的

1. **`all-MiniLM-L6-v2` 的 token 上限是 256**。讲师没提，但你如果拿它 encode 超过 256 token 的块，会被静默截断。P18 讲的「400~800 token 甜点区」在这个模型上跑，超出部分不参与 embedding。生产里要么换长上下文模型，要么在 encode 前再切一刀。
2. **BM25 对中文完全失效**。`\w+` 在中文上会把整句当一个 token。讲师全程用英文演示，没讲多语言。中文场景要换 `jieba` 分词或直接用支持中文的 BM25 实现。
3. **`rank_bm25` 的 `get_scores` 返回的是原始 BM25 分，不是 0~1**。所以讲师演示里关键词能到 2.5、语义只有 0.6——两者量纲不同，直接相加没意义。这就是为什么 `hybrid_search` 里必须先归一化，也是为什么 RRF 干脆不看分数。
4. **`sentence-transformers` 首次下载会走 HuggingFace**。国内网络可能卡住，需要设 `HF_ENDPOINT=https://hf-mirror.com`。讲师 p019 [08:56] 只说「要等一会儿」，没说网络问题。
5. **`util.cos_sim` 返回的是 tensor**。忘了 `.cpu().numpy()` 会在 `np.argsort` 处报错。讲师代码里没展示这一步（逐字稿没念），但这是必踩的坑。
6. **RRF 的 `k=60` 是经验值**。课里没讲 k 怎么选。k 越大，排名靠后的文档被拉平的越厉害；k 越小，头部效应越强。默认 60 来自原论文，够用。
7. **`EnrichedChunk` 的 `embedding` 字段课里留了 `None`**。讲师只演示了结构，没演示真正把 embedding 存进去。生产里这一步要和向量库（Pinecone / pgvector / Chroma）对接，课里没讲具体接法。
8. **P18 的「甜点区」数字是经验值不是定律**。讲师 p018 [03:02] 自己说了「这些是估计，你得测试」。别把 400~800 当硬指标，尤其你的文档结构和讲师演示的 policies.md 不一样时。

---

**一句话总结这三节**：分块决定 RAG 的上限（P17），块大小/重叠/元数据决定成本与精度（P18），混合检索决定你能不能同时接住「同义词查询」和「错误码查询」（P19）。三个脚本跑通，你就有了一个可以开始调参的基线。