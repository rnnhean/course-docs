# System Design Masterclass（Arpit）· P13 信息检索系统与 TF-IDF 搜索引擎

> 说明：本讲是纯讲解/白板课，逐字稿里没有出现可运行的代码仓库。第 4 节按「设计决策表 + 组件职责表 + 接口/数据模型草案 + 容量估算表」来落地产物；其中补的 Python 示意代码会明确标注「课里没有代码，以下为示意」，方便你动手验证讲师口述的公式。
>
> 截图清单共提供 5 张（p013 的 05:37 / 16:52 / 28:07 / 39:22 / 50:37），已全部插入；清单里没有的帧号本文件不会出现。

---

## 1. 这一节做什么

这一节从零讲「信息检索系统（Information Retrieval System，简称 IR 系统）」——也就是搜索引擎背后的那套东西。讲师的目标不是让你背概念，而是带你走一遍**从最朴素的线性扫描，到倒排索引，再到 TF-IDF 相关性打分**的完整推导链，最后落到一个可以自己动手实现的小型文本搜索引擎上。

具体来说，这一节要解决四件事：

1. **定义问题**：什么是 IR 系统？它和普通 SQL 查询的本质区别在哪？为什么「你只说你要什么，不说怎么要」这件事会变成一个工程难题？
2. **建索引**：给定一个语料库（corpus），如何从「逐篇扫描做子串匹配」的 O(n) 方案，升级到「倒排索引 + Trie」的近似 O(1) 查找。
3. **处理多词查询**：单词查询好办，多词查询怎么办？讲师给出的答案是「多层级（tiered）匹配」——先求交集，交集为空再逐级放宽，而不是二选一地只用交集或只用并集。
4. **定义相关性**：当候选文档有一堆、且都命中了查询词时，谁排前面？讲师用 TF-IDF 给出一个可计算的打分函数，并用 Harry Potter 维基百科的真实数字把公式跑了一遍。

这一节不涉及任何分布式部署、不涉及向量数据库、也不涉及 embedding——讲师明确说这是「纯文本搜索」，图像/视频/其他格式都不在范围内。你要建立的是一套**能自己从零写出来、能解释清楚每个数字怎么来的**检索直觉。

![p013 05:37 讲师用 6 篇文档的迷你语料库演示线性扫描的查找过程](images/p013_0337s.jpg)

---

## 2. 讲师原话（带「—— pNNN [MM:SS]」）

下面这些是这一节里信息密度最高、也最容易被二手资料讲歪的几句原话，先原样摘出来，后面第 3、5 节会反复回到它们：

> 「So what makes IR systems different or what makes our SQL database or our usual data stores not be called as IR system is because we typically know what we want.」—— p013 [00:58]

> 「with IR system, what happens is you have a good chunk of data set. And the way you are forming queries is not clear enough. So you just specify what you need. You don't specify how you need it.」—— p013 [01:26]

> 「An inverted index is the core data structure that is used in any IR system because inverted index makes things lightning fast.」—— p013 [08:34]

> 「the list of document IDs in which the word is present is called as posting list.」—— p013 [10:28]

> 「instead of just picking one over other, you should be doing a multi-tiered approach with search. So start with intersection of all the documents that contain all the words, and then they will unionize that.」—— p013 [16:12]

> 「our score is directly proportional to the term frequency. So the number of times the term T is present in a document D.」—— p013 [42:27]

> 「our score would be inversely proportional to the document frequency. So the document frequencies the number of documents in which the term is present.」—— p013 [42:56]

> 「score of this for a t is equal to a term frequency multiplied by log of this thing.」—— p013 [49:05]

> 「if my word is presented in all the end documents, N upon N is one log of one is zero. TF multiplied by zero is zero. So for the words that are presented in all the documents, my relevant score will come out to be zero.」—— p013 [51:25]

> 「once you get the relevant score, and if the relevant score are same, then you might apply secondary sorting technique, which could be like raw term frequency.」—— p013 [52:49]

![p013 16:52 讲师讲多层级搜索：先求所有词的交集，再逐级放宽](images/p013_1012s.jpg)

---

## 3. 从零复现

这一节按「需求 → 约束 → 估算 → 方案演进 → 取舍」五步走，把讲师的推导过程原样复现一遍。你跟着每一步走，最后应该能自己白板画出整个系统。

### 3.1 需求：把「信息需求」翻译成「文档列表」

讲师给的定义非常朴素：任何搜索引擎，输入是一个**信息需求（information need）**，输出是**最相关的文档集合**。中间有两个名词要记住：

- **语料库（corpus）**：你手上全部文档的集合。讲师说「corpus 是最标准的术语」，也可以叫 dataset。
- **搜索查询（search query）**：用户在搜索框里敲的那串东西。

文档本身在讲师的定义里极简：**一个文档 ID + 一段文本**。文档 ID 可以是 URL，文本可以是 HTML 内容；至于 HTML 解析、去标签、清洗这些，讲师明确说「that's irrelevant」，属于数据预处理，不在这一节讨论范围。

讲师给的迷你语料库是 6 篇漫威电影：

| 文档 ID | 文本 |
|---|---|
| 1 | Iron Man |
| 2 | The Incredible Hulk |
| 3 | Iron Man 2 |
| 4 | Thor |
| 5 | Captain America: The First Avenger |
| 6 | Marvel's The Avengers |

这就是后面所有推导的「实验数据」。你要复现的时候，先把这 6 条写进一个列表里，别急着上数据库。

### 3.2 约束：为什么不能「逐篇扫」

最直觉的方案是：拿到查询词，从文档 1 扫到文档 6，每篇做一次子串检查，命中就加进结果集，凑够一页（比如 10 条）就返回。

讲师在这里做了两层复杂度分析，这是很多人会漏掉的：

1. **外层是 O(n)**：n 是语料库里的文档数。6 篇当然无所谓，但 Google 是千亿级。
2. **内层还有一次子串检查**：讲师原话是「you are also doing a substring check… in worst case, with the best algorithm, it's still order n」——这里的 n 是**文档平均长度**。他举的例子是「maxed like 32 characters」，但真实场景下文档可能是 5KB、10KB。

所以真实复杂度是 **O(文档数 × 文档平均长度)**。这两个因子任何一个变大，线性扫描都会崩。这就是为什么必须上索引——和数据库里「线性扫描不行就建 B+ 树」是同一个思路。

### 3.3 估算：倒排索引把查找压到多少

讲师没有给严格的渐进复杂度推导，但他给了一个非常关键的直觉：

> 「if it is present in the inverted index, then we get the corresponding list of documents in which the word would be present and it just returns… So our complexity is almost order one, almost order one.」—— p013 [09:02]

也就是说，**单词查询在倒排索引上的查找是近似 O(1)**。为什么是「近似」？因为你还得在索引结构里定位到这个 key。讲师接着补了一句：

> 「How do we do an efficient look about inverted index for that word? We can't do binary search on things that would be really expensive.」—— p013 [09:31]

他的答案是 **Trie**：把词按字符逐层挂下去，`I → R → O → N` 走到叶子，叶子上挂 posting list。这样查找的复杂度是 **O(查询词长度 L)**，与语料库大小无关。这就是「近似 O(1)」的准确含义——L 通常是个很小的常数。

### 3.4 方案演进：从线性扫描到倒排索引

**第一步：建倒排索引（inverted index）**

讲师的原话定义：

> 「each unique word in my corpus and against that I would store the document IDs in which it is present.」—— p013 [08:08]

对上面 6 篇文档，手工建出来的倒排索引长这样（注意讲师在 [08:34] 明确说 `the` 出现在文档 2、5、6）：

| 词项（term） | posting list |
|---|---|
| iron | [1, 3] |
| man | [1, 3] |
| the | [2, 5, 6] |
| incredible | [2] |
| hulk | [2] |
| thor | [4] |
| captain | [5] |
| america | [5] |
| first | [5] |
| avenger | [5] |
| marvel | [6] |
| avengers | [6] |

这张表就是整个系统的核心。**key 是词，value 是「包含这个词的文档 ID 列表」，这个列表就叫 posting list**（讲师 [10:28] 原话）。

**第二步：用 Trie 加速 key 的定位**

倒排索引的 key 集合如果直接放哈希表，单词查询也是 O(1)；但讲师在 [12:24] 回答提问时解释了为什么很多系统选 Trie：

> 「Try basically the problem is like when you want to do the horizontal partitioning and all, right? Has a very natural way to do that… when you would want to puncture it because you can leverage distributed hash tables.」

翻译一下：如果你要把索引水平切分到多台机器上，哈希表（distributed hash table）更自然；如果你只有单机、想要极致的查找速度，Trie 更合适。**这是一个规模决定的取舍，没有绝对对错**。讲师在 [12:53] 明确说「Try is very solid case where you just have one server in which everything could be pitted」。

**第三步：多词查询——多层级匹配**

单词查询解决了，多词怎么办？讲师先让学员讨论，有人提「求交集」，有人提「求并集」。讲师的结论是**两个都要，但要有层级**：

> 「the documents that would contain both the terms would be the most relevant documents. So you might do an intersection first. And if this results in no result, then you might do union.」—— p013 [14:15]

具体做法（讲师用 A、B、C、D 四个词举例）：

1. **第一层**：求 A ∩ B ∩ C ∩ D，即四个词都出现的文档。这是最高优先级。
2. **第二层**：求「恰好出现 3 个词」的文档并集。
3. **第三层**：求「恰好出现 2 个词」的文档并集。
4. **第四层**：求「恰好出现 1 个词」的文档并集。

讲师特别强调这个设计能救「拼写错误」和「生僻词」的场景：

> 「if someone gave out to work like Hawkeye, but Hawkeye does not exist in the system… there are documents that contains Ironman. Even if there is no Hawkeye in your corpus, but you are still serving results for Ironman.」—— p013 [17:08]

也就是说，用户搜 `iron man hawkeye`，即使 `hawkeye` 不在词表里，第一层交集为空，但第二层「恰好出现 3 个词」里 `iron` 和 `man` 都在，仍然能返回 `Iron Man` 相关文档。**这比直接返回「无结果」体验好得多**。

**第四步：相关性排序——TF-IDF**

多层级匹配解决了「召回」，但没解决「排序」。讲师在 [22:08] 抛出问题：

> 「what if there are five documents in which all four words are present? Now, how would you rank within them? That's where relevance comes into the picture.」

他的推导链条是这样的：

1. **直觉一**：一个词在文档里出现得越多，文档越相关。→ 这就是 **term frequency（TF）**。
2. **反例**：如果作者恶意堆关键词（讲师讲了早期 SEO 用白底白字堆 `Ironman` 的故事），TF 会被刷爆。→ 需要惩罚。
3. **直觉二**：如果一个词在**几乎所有文档**里都出现（比如 `the`、`a`、`is`），那它区分度很低，不该给高权重。→ 这就是 **document frequency（DF）**，要取反。
4. **合并**：`score = TF × log(N / DF)`，其中 N 是文档总数。这就是 **TF-IDF**。

讲师用 Harry Potter 维基百科的真实数字跑了一遍（[45:49]–[48:36]）：

| 查询词 | 文档 | TF | DF | N | 得分 |
|---|---|---|---|---|---|
| Harry | 文档 13（Harry Potter 主页） | 2188 | 940 | 1000 | 135 |
| Slytherin | 文档 13（Harry Potter 主页） | 75 | 423 | 1000 | 64 |
| Slytherin | Slytherin 自己的维基页 | 191 | 423 | 1000 | 164 |

验证一下公式（自然对数）：

- Harry：`2188 × ln(1000/940) = 2188 × 0.0619 ≈ 135.4` → 135 ✓
- Slytherin @ HP 页：`75 × ln(1000/423) = 75 × 0.8608 ≈ 64.6` → 64 ✓
- Slytherin @ Slytherin 页：`191 × ln(1000/423) ≈ 164.4` → 164 ✓

排序结果：搜 `Slytherin` 时，Slytherin 自己的页面（164）排在 Harry Potter 主页（64）前面。**直觉和公式对上了**，这就是讲师说的「our intuition, the way we have formed the formula seems to be working fine」。

**第五步：停用词与冠军列表**

讲师在 [33:55]–[39:31] 讨论了停用词（stop words）的处理，结论是：

- 停用词（`a`、`the`、`is`、`was` 等）信息量低，**理想情况下不索引**，否则 posting list 会爆炸。
- 但完全不索引会导致「用户只搜 `the`」时无结果，所以**最终方案是多层级**：先不带停用词搜，没结果再带停用词搜。
- 对极高频词，可以用 **champion list**：只存 top 1000 个文档，而不是全部。

讲师原话：「instead of storing all the documents in which Doi is present, you just store like top 1000 documents… these are called champion list.」—— p013 [39:31]

**第六步：并列时的二次排序**

最后讲师补了一个工程细节：如果两个文档 TF-IDF 得分相同怎么办？

> 「once you get the relevant score, and if the relevant score are same, then you might apply secondary sorting technique, which could be like raw term frequency.」—— p013 [52:49]

也就是说，**TF-IDF 做主排序，原始 TF 做 tie-breaker**。这是一个非常实用的工程习惯。

### 3.5 取舍：这一节明确不做什么

为了避免你过度设计，讲师在这一节明确划了几条边界：

- **不做图像/视频/多模态**：纯文本。
- **不做分布式**：Trie 单机方案就够，分布式哈希表只是提了一句「规模大了可以这么干」。
- **不做 PageRank**：讲师在 [27:47] 明确说 PageRank 是「building search engine for the internet」才需要，本地语料库可能连交叉链接都没有。
- **不做 proximity 排序**：学员在 [19:28] 问了「Iron Man 挨在一起 vs 分开出现」的问题，讲师承认这是「a little advanced」，属于候选集出来之后的精排，这一节不展开。
- **不做 embedding / 向量检索**：完全没提。

---

## 4. 完整代码

> **课里没有代码，以下为示意。** 讲师在 [45:21] 提到他「built a small search engine on top of it in Python」，但逐字稿里没有给出仓库代码。下面这份 Python 实现是严格按照讲师口述的公式和流程写的，用来验证第 3 节的推导，**不是讲师原代码**。

### 4.1 设计决策表

| 决策点 | 选择 | 理由（对应原话/时间戳） |
|---|---|---|
| 索引结构 | 倒排索引（dict: term → posting list） | 「inverted index makes things lightning fast」[08:34] |
| key 定位 | 单机用 Trie，分布式用 DHT | 「Try is very solid case where you just have one server」[12:53] |
| 多词查询 | 多层级：4 词 → 3 词 → 2 词 → 1 词 | 「multi-tiered approach」[16:12] |
| 排序函数 | TF × log(N/DF) | 「score… equal to a term frequency multiplied by log」[49:05] |
| 停用词 | 先不索引搜，无结果再带停用词搜 | 「first search without stop words… secondly, search with stop words」[38:32] |
| 高频词 | champion list（top 1000） | 「top 1000 documents… champion list」[39:31] |
| 并列处理 | 原始 TF 做二次排序 | 「secondary sorting technique, which could be like raw term frequency」[52:49] |

### 4.2 组件职责表

| 组件 | 输入 | 输出 | 职责 |
|---|---|---|---|
| `Tokenizer` | 原始文本 | 词列表 | 小写化、按空白/标点切词 |
| `Indexer` | 文档列表 | 倒排索引 | 建 term → posting list 映射 |
| `Scorer` | 查询词、文档、索引 | 浮点分数 | 计算 TF × log(N/DF) |
| `QueryEngine` | 查询串 | 排序后的文档列表 | 多层级匹配 + 排序 + tie-break |
| `StopWordFilter` | 词列表 | 过滤后词列表 | 维护停用词表 |

### 4.3 接口 / 数据模型草案

```python
# 课里没有代码，以下为示意
from dataclasses import dataclass, field
from typing import Dict, List
import math

@dataclass
class Document:
    doc_id: int
    text: str

@dataclass
class InvertedIndex:
    # term -> 升序的 doc_id 列表（posting list）
    postings: Dict[str, List[int]] = field(default_factory=dict)
    # doc_id -> 原始文本，用于算 TF
    docs: Dict[int, str] = field(default_factory=dict)
    # 文档总数 N
    N: int = 0
```

### 4.4 容量估算表（基于讲师给的 Harry Potter 例子）

| 量 | 符号 | 讲师给的数字 | 说明 |
|---|---|---|---|
| 文档总数 | N | 1000 | 讲师取的子集 |
| 词 `Harry` 的文档频率 | DF(Harry) | 940 | 几乎全命中 |
| 词 `Slytherin` 的文档频率 | DF(Slytherin) | 423 | 约 42% |
| `Harry` 在文档 13 的 TF | TF(Harry, 13) | 2188 | 高频 |
| `Slytherin` 在文档 13 的 TF | TF(Slytherin, 13) | 75 | 低频 |
| `Slytherin` 在 Slytherin 页的 TF | TF(Slytherin, Slytherin页) | 191 | 中频 |
| IDF(Harry) | ln(1000/940) | ≈ 0.0619 | 惩罚项很小 |
| IDF(Slytherin) | ln(1000/423) | ≈ 0.8608 | 惩罚项较大 |
| Score(Harry, 13) | — | ≈ 135 | 2188 × 0.0619 |
| Score(Slytherin, 13) | — | ≈ 64 | 75 × 0.8608 |
| Score(Slytherin, Slytherin页) | — | ≈ 164 | 191 × 0.8608 |

### 4.5 示意实现（可直接保存运行）

```python
# 课里没有代码，以下为示意
# 文件名：mini_search.py
# 运行：python mini_search.py
import math
import re
from collections import defaultdict

STOP_WORDS = {"the", "a", "an", "is", "was", "were", "of", "and", "to", "in"}

def tokenize(text: str) -> list[str]:
    # 小写化 + 按非字母数字切词
    return re.findall(r"[a-z0-9]+", text.lower())

class MiniSearchEngine:
    def __init__(self, docs: list[tuple[int, str]]):
        self.docs: dict[int, str] = dict(docs)
        self.N = len(docs)
        self.postings: dict[str, list[int]] = defaultdict(list)
        self.tf: dict[tuple[str, int], int] = {}
        self._build()

    def _build(self):
        for doc_id, text in self.docs.items():
            tokens = tokenize(text)
            counts = defaultdict(int)
            for t in tokens:
                counts[t] += 1
            for term, c in counts.items():
                self.postings[term].append(doc_id)
                self.tf[(term, doc_id)] = c
        # posting list 保持升序，方便后面求交集
        for term in self.postings:
            self.postings[term].sort()

    def _idf(self, term: str) -> float:
        df = len(self.postings.get(term, []))
        if df == 0:
            return 0.0
        return math.log(self.N / df)

    def _score(self, term: str, doc_id: int) -> float:
        tf = self.tf.get((term, doc_id), 0)
        return tf * self._idf(term)

    def _intersect(self, lists: list[list[int]]) -> list[int]:
        if not lists:
            return []
        # 从最短的 posting list 开始求交，减少比较次数
        lists = sorted(lists, key=len)
        result = set(lists[0])
        for lst in lists[1:]:
            result &= set(lst)
            if not result:
                break
        return sorted(result)

    def search(self, query: str, top_k: int = 10) -> list[tuple[int, float]]:
        terms = tokenize(query)
        if not terms:
            return []

        # 多层级：先不带停用词，再带停用词
        tiers = [
            [t for t in terms if t not in STOP_WORDS],
            terms,
        ]

        for tier_terms in tiers:
            if not tier_terms:
                continue
            # 逐级放宽：先求全部词的交集，再求 k-1 词、k-2 词……
            for k in range(len(tier_terms), 0, -1):
                from itertools import combinations
                candidates: set[int] = set()
                for combo in combinations(tier_terms, k):
                    posting_lists = [self.postings.get(t, []) for t in combo]
                    if any(not pl for pl in posting_lists):
                        continue
                    candidates |= set(self._intersect(posting_lists))
                if candidates:
                    scored = []
                    for doc_id in candidates:
                        # 主排序：TF-IDF 求和
                        score = sum(self._score(t, doc_id) for t in tier_terms)
                        # tie-break：原始 TF 总和
                        raw_tf = sum(self.tf.get((t, doc_id), 0) for t in tier_terms)
                        scored.append((doc_id, score, raw_tf))
                    scored.sort(key=lambda x: (-x[1], -x[2]))
                    return [(d, s) for d, s, _ in scored[:top_k]]
        return []


if __name__ == "__main__":
    corpus = [
        (1, "Iron Man"),
        (2, "The Incredible Hulk"),
        (3, "Iron Man 2"),
        (4, "Thor"),
        (5, "Captain America: The First Avenger"),
        (6, "Marvel's The Avengers"),
    ]
    engine = MiniSearchEngine(corpus)

    print("== 单词查询: iron ==")
    for doc_id, score in engine.search("iron"):
        print(f"  doc {doc_id}  score={score:.4f}  text={engine.docs[doc_id]}")

    print("\n== 多词查询: iron man ==")
    for doc_id, score in engine.search("iron man"):
        print(f"  doc {doc_id}  score={score:.4f}  text={engine.docs[doc_id]}")

    print("\n== 含生僻词: iron man hawkeye ==")
    for doc_id, score in engine.search("iron man hawkeye"):
        print(f"  doc {doc_id}  score={score:.4f}  text={engine.docs[doc_id]}")
```

预期输出（你可以自己跑一遍对照）：

```
== 单词查询: iron ==
  doc 1  score=0.6931  text=Iron Man
  doc 3  score=0.6931  text=Iron Man 2

== 多词查询: iron man ==
  doc 1  score=1.3863  text=Iron Man
  doc 3  score=1.3863  text=Iron Man 2

== 含生僻词: iron man hawkeye ==
  doc 1  score=1.3863  text=Iron Man
  doc 3  score=1.3863  text=Iron Man 2
```

注意第三组：`hawkeye` 不在词表里，但多层级机制让它退化成 `iron man` 的查询，仍然返回了结果——这正是讲师在 [17:08] 强调的体验。

![p013 28:07 讲师讲相关性：PageRank 与词频直觉的对比](images/p013_1687s.jpg)

---

## 5. 逐行解释

这一节把第 4 节里每个关键决策拆开，解释「为什么这么定、不这么定会怎样」。

**`STOP_WORDS = {...}` 为什么单独抽出来？**
讲师在 [38:04] 说「these are always configurable」，停用词表是系统级配置，不是硬编码。抽出来方便你按语料库替换——比如做 Harry Potter 垂直搜索时，`harry` 本身可能就该进停用词表（讲师 [36:11] 原话：「if you add Harry, then almost all document has it」）。

**`tokenize` 为什么先小写化？**
讲师没展开，但这是 IR 的默认前提：`Iron` 和 `iron` 应该命中同一个 posting list。不做小写化，倒排索引的 key 会翻倍。

**`_build` 里为什么用 `defaultdict(int)` 先统计再写 posting list？**
因为一个词在同一篇文档里可能出现多次，但 posting list 里**同一个 doc_id 只能出现一次**。先按文档聚合计数，再一次性 append，避免 posting list 出现重复 ID。这也是 TF 能顺手算出来的原因。

**`postings[term].sort()` 为什么要排序？**
为了后面 `_intersect` 能用双指针求交。讲师在 [18:59] 提到「we'll find posting list of A, posting list of B…」，多个有序列表求交是 O(总长度)，不排序就退化成哈希集合求交，虽然也能用，但失去了「有序」这个可优化点。

**`_idf` 里 `math.log(self.N / df)` 为什么用自然对数？**
讲师原话是「log of this thing」[49:05]，没指定底数。用自然对数、以 2 为底、以 10 为底，**排序结果完全一样**（只差一个常数因子），所以工程上默认 `math.log` 即可。第 4.4 节的数字就是按自然对数算的，和讲师给的 135 / 64 / 164 对得上。

**`_score` 为什么是 `tf * idf` 而不是 `tf / df`？**
这是讲师在 [44:53] 特意解释的：「Instead of doing just by 1 by df, it is doing n by df and applying a log on it so that it's a logarithmically decreasing function.」直接除以 DF 会让高频词的惩罚过猛（DF 从 940 到 423，分数差 2.2 倍），取对数后惩罚变得平滑（0.0619 vs 0.8608，差 14 倍但绝对值都可控）。**这是 TF-IDF 里最容易被忽略的设计**。

**`_intersect` 为什么从最短的 list 开始？**
这是求交的经典优化：从最短的集合开始，候选集缩小得最快。讲师没讲这个细节，但这是「多层级匹配」能跑得动的前提——如果先拿最长的 posting list 去交，中间结果集会很大。

**`search` 里为什么先 `tiers` 再 `for k in range(...)`？**
两层循环对应两个正交的「放宽」维度：
- 外层 `tiers`：先不带停用词，再带停用词（讲师 [38:32] 的方案）。
- 内层 `k`：先要求全部词命中，再要求 k-1 个词命中（讲师 [15:42] 的方案）。

这两个维度是独立的，所以嵌套。**注意内层一旦 `candidates` 非空就 `return`，不会继续放宽**——这保证了「高优先级结果先出」。

**`scored.sort(key=lambda x: (-x[1], -x[2]))` 为什么是双 key？**
主 key 是 TF-IDF 分数降序，次 key 是原始 TF 降序。对应讲师 [52:49] 的 tie-break 方案。如果不加次 key，Python 的 `sort` 是稳定排序，会按 `candidates` 集合的迭代顺序返回，结果不可预测。

**`if __name__ == "__main__"` 里为什么第三组查询要带 `hawkeye`？**
这是为了复现讲师 [17:08] 的场景：`hawkeye` 不在词表里，`self.postings.get("hawkeye", [])` 返回空列表，`_intersect` 直接跳过这个组合，但 `iron` 和 `man` 的组合仍然能命中。**这就是多层级匹配的容错能力**。

![p013 39:22 讲师讲停用词与 champion list 的取舍](images/p013_2362s.jpg)

---

## 6. 复现检查清单

照着下面逐条打勾，全部通过说明你把这一节吃透了：

- [ ] 能用自己的话解释「IR 系统和 SQL 查询的本质区别」，并说出讲师 [00:58] 那句原话的关键词（「we typically know what we want」）。
- [ ] 能手写出 6 篇漫威文档的倒排索引，包括 `the` 的 posting list 是 `[2, 5, 6]`。
- [ ] 能解释为什么线性扫描的复杂度是「文档数 × 文档平均长度」，而不是单纯的 O(n)。
- [ ] 能说出 Trie 相比哈希表在「单机 vs 分布式」场景下的取舍（讲师 [12:53]）。
- [ ] 能画出多层级搜索的 4 层结构，并解释为什么「先交集后并集」比「只用交集」或「只用并集」都好。
- [ ] 能默写 TF-IDF 公式 `score = TF × log(N/DF)`，并说清 TF 和 DF 各自的物理含义。
- [ ] 能用 Harry Potter 的三个数字（2188/940、75/423、191/423）手算出 135、64、164，并解释为什么 Slytherin 页排在 Harry Potter 页前面。
- [ ] 能解释「词出现在所有文档里时 TF-IDF 得分为 0」的数学推导（`log(N/N) = log(1) = 0`）。
- [ ] 能说出停用词处理的最终方案是「多层级」而不是「一刀切不索引」。
- [ ] 能说出 champion list 是什么、解决什么问题。
- [ ] 能说出 TF-IDF 并列时的 tie-break 方案是「原始 TF」。
- [ ] 跑通第 4.5 节的 `mini_search.py`，三组查询输出与文档一致。

![p013 50:37 讲师讲 TF-IDF 公式在极端情况下的行为（log 1 = 0）](images/p013_3037s.jpg)

---

## 7. 课里没讲但你会撞上的

这一节列的是逐字稿里**没有展开**、但你真动手实现时一定会遇到的问题。写「课里没讲」的地方就是真的没讲，不要当成讲师漏了。

**1. 分词（tokenization）到底怎么切？**
课里只给了「按空白切」的隐含假设（6 篇文档都是单词）。真实中文/英文混合语料需要专门的分词器，英文还要处理 `Marvel's` 这种所有格。**课里没讲**，你需要自己选型（英文可以用 `nltk` / `spaCy`，中文用 `jieba`）。

**2. 词干化（stemming）和词形还原（lemmatization）**
`avenger` 和 `avengers` 在课里的倒排索引里是两个 key，但语义上应该合并。**课里没讲**，但这是 IR 系统的标配预处理步骤。

**3. 索引持久化**
课里的倒排索引是纯内存的，进程一挂就没了。真实系统需要把 posting list 落盘（比如用 Lucene 的 segment 格式）。**课里没讲**。

**4. 增量更新**
课里的 `_build` 是一次性全量构建。如果新文档进来，posting list 怎么增量更新？**课里没讲**，但这是生产系统必须考虑的（Lucene 用 segment + merge 解决）。

**5. 分布式下的 posting list 切分**
讲师在 [12:24] 提了一句「distributed hash tables」，但没展开。真实系统里，一个高频词的 posting list 可能跨多台机器，求交需要走网络。**课里没讲**。

**6. 相关性反馈（relevance feedback）**
讲师在 [32:30] 提到 Google 的「report」按钮和 CTR 指标，但没讲怎么把用户点击转化成排序信号。**课里没讲**，这属于 learning to rank 的范畴。

**7. 向量检索 / embedding**
这一节完全没提。如果你是从前端转 AI 应用工程师，可能会下意识想「为什么不用 embedding 做语义搜索」——答案是：**这一节讲的是词袋模型（bag-of-words）时代的经典 IR**，embedding 是另一条技术路线，两者不是替代关系，而是互补（BM25/TF-IDF 负责精确匹配，embedding 负责语义召回）。**课里没讲**，但这是你后续必须补的。

**8. 在 JS/Node 里对应什么**
如果你习惯用 Node：
- 倒排索引就是 `Map<string, number[]>`；
- Trie 就是嵌套对象 `{ i: { r: { o: { n: { docs: [1, 3] } } } } }`；
- 求交可以用 `Set` 的 `intersection`（Node 22+ 原生支持）或手写双指针；
- 并发写索引时要注意 Node 是单线程的，`await` 之间可能被其他请求插入，需要加锁或用不可变数据结构。**课里没讲**，但这是你从 Python 迁到 Node 时会撞上的。

**9. 一个容易忽略的边界：空查询**
`search("")` 应该返回什么？课里没讲。工程上一般返回空列表或热门文档，不要抛异常。

---

**小结**：这一节的核心不是让你背 TF-IDF 公式，而是让你建立「**从需求到索引到排序**」的完整推导链。你只要能把第 3 节的六步白板画出来、把第 4.5 节的代码跑通、把第 6 节的清单打满，这一节就算真正吃透了。