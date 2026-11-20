# Prometheus & Grafana · P017 收尾：把监控栈干净地关掉，以及接下来练什么

> 本节是全课最后一节（P017，共 17 节里的第 17 节）。它**不引入新组件**，做两件事：给出继续练习的三条路线，然后把你机器上跑着的四个监控容器停掉、删掉。
>
> 所以这份文档的“可复现产物”是：**一台回到干净状态的机器 + 一套可以反复重建/拆除的最小脚手架**。其中 `docker-compose.yml` 和 `prometheus.yml` 属于“补充脚手架”——**本节没讲怎么起容器**（那是前面课的内容），我把它们写全，只是为了让你能先起、再按本节的方法拆，形成闭环。

---

## 1. 这一节做什么

学完 16 节之后，你的机器上大概率还挂着四个一直在跑、一直在采集、一直在写磁盘的容器：`prometheus`、`grafana`、`node-exporter`、`cadvisor`。讲师在这一节明确要求把它们清理掉，理由是**释放机器资源**——这四个东西不是“关掉浏览器就没事”的前端 dev server，它们是常驻进程 + 时序数据库 + 面板服务，Prometheus 还会按 `storage.tsdb.path` 往磁盘里持续落数据。

具体到可执行的动作，只有两条命令、八个参数：

```bash
docker stop prometheus grafana node-exporter cadvisor
docker rm   prometheus grafana node-exporter cadvisor
```

看起来简单，但这里有几个**会真的绊倒前端同学**的点，本节会全部展开：

1. `stop` 和 `rm` 是两步，顺序不能反。容器还在 running 时直接 `rm` 会失败。
2. 你敲的是**容器名**，不是镜像名，也不是容器 ID。名字打错一个字符，整条命令会报错。
3. `docker rm` **不删数据卷**。Prometheus 的 TSDB 和 Grafana 的 `grafana.db` 会留在卷里，下次起来数据还在（这可能是好事，也可能是坑）。
4. 如果你当初是用 `docker compose up -d` 起的，那正确的拆除方式是 `docker compose down`，而不是手动 `docker rm`——两者对“项目状态”的影响不一样。

除了清理，讲师还给了一份“学完之后往哪走”的清单，我按他的原话整理成三条路线，见第 2 节。

![p017 00:06 讲师开始结课总结，回顾整门课覆盖的组件与配置项](images/p017_0006s.jpg)

---

## 2. 讲师原话（带时间戳）

**开场总结（p017 [00:00]）**

> “Congratulations! You've made it to the end of this course on Prometheus and Grafana. We went through a lot of components, but taking into the account previous video for good practices and amount of configuration elements that these tools gave, where you can go from here, for sure keep practicing. The best way to solidify what you've learned...”

—— p017 [00:00]。要点：这门课的组件多、配置项多，**唯一巩固方式就是继续练**。

**路线一：监控真实项目 + 逛 exporter 生态（p017 [00:27]）**

> “...is to monitor real projects, set up Prometheus and Grafana for your own applications, explore the exporter ecosystem. There are exporters for almost every popular technology, including MySQL, PostgreSQL, Redis and GenX, Apache, Elasticsearch and many, many more. And you can always reference the Prometheus documentation for the full list.”

—— p017 [00:27]。要点：几乎每种主流技术都有官方或社区 exporter；完整清单看 Prometheus 官方文档。（转写里出现的 “GenX” 疑为 nginx 的口误/转写误差，**以官方 exporter 列表为准**。）

![p017 00:31 讲师列举 exporter 生态：MySQL、PostgreSQL、Redis、Apache、Elasticsearch 等](images/p017_0031s.jpg)

**路线二：深入 PromQL 与告警（p017 [00:54]）**

> “You can dive deeper also into advanced PromQL, including, for example, exploring recording crews for pre-computing expensive queries and sub-queries for complex analysis. You can explore a writing crews in Prometheus itself because actually you don't need Grafana to send alerts if that would be your choice.”

—— p017 [00:54]。要点：① **recording rules**（口播/转写为 “recording crews”）用来预计算昂贵查询；② **sub-queries** 用于复杂分析；③ **alerting rules**（口播/转写为 “writing crews”）可以只在 Prometheus 里做，**告警不必须依赖 Grafana**。

**路线三：长期存储（p017 [01:22]）**

> “You can look into long-term storage solutions and from them, there are like Thanos, Cortex or Mimir. So if you need to retain your metrics for months or years.”

—— p017 [01:22]。要点：需要按月/按年保留指标时，考虑 Thanos / Cortex / Mimir。**这三个怎么装，课里没讲**，本节只提到名字。

![p017 01:20 讲师提到长期存储方案 Thanos、Cortex、Mimir](images/p017_0080s.jpg)

**清理（p017 [01:22] – [01:50]）**

> “Before we actually finish, you should also clean up the Docker containers if you were following along. So we've been running and now we should stop and remove the containers with Docker stop and then the name of the containers. So Prometheus, Grafana, node exporter and C advisor and then this Docker RM Prometheus Grafana node exporter and C advisor. We did that a few times when we were restarting the Prometheus. This will stop and remove all the monitoring containers and this will free up resources on your machine...”

—— p017 [01:22] / [01:50]。要点：
- 先 `docker stop`，**再** `docker rm`；
- 参数是**容器名**；
- 讲师说这套 `stop + rm` 在重启 Prometheus 时已经重复过几次——也就是说它同时是“重启套路”。

![p017 01:44 讲师演示用 docker stop 加上容器名停止四个监控容器](images/p017_0104s.jpg)

![p017 01:57 讲师演示 docker rm 删除四个已停止的容器以释放资源](images/p017_0117s.jpg)

**结尾（p017 [02:09] – [03:03]）**

> “...I would be grateful if you could leave a review... If you enjoyed it, I have other hands-on courses covering... Kubernetes, AWS, Linux, databases like Postgres...”

—— p017 [02:09] / [02:49]。纯结课致辞，无技术内容。

![p017 02:09 讲师请学员留评价，说明评价对课程改进的作用](images/p017_0129s.jpg)

---

## 3. 从零复现

> 目标：在你自己的机器上，**先把四个容器跑起来 → 按本节方法拆掉 → 验证拆干净了**。只有先起过，你才知道 `stop`/`rm` 到底动了什么。

### 步骤 0：确认环境（课里没讲版本要求）

```bash
docker version
docker compose version
```

`docker compose`（v2，作为 docker 子命令）和 `docker-compose`（v1，独立二进制）是两代东西。下面的脚本用 v2 写法。

### 步骤 1：准备目录与文件

```bash
mkdir -p ~/prom-grafana-lab
cd ~/prom-grafana-lab
```

然后按第 4 节把 `docker-compose.yml` 和 `prometheus.yml` 两个文件存到该目录。**注意 `prometheus.yml` 必须和 compose 文件同级**，因为 compose 里用的是相对路径 `./prometheus.yml`。

### 步骤 2：起容器（补充脚手架，本节没讲）

```bash
docker compose up -d
docker compose ps
```

看到四个服务都是 running 即可。此时机器上就有了讲师口播的那四个名字对应的容器。

### 步骤 3：按本节方法——先 stop

**照讲师的写法，一条命令带四个名字：**

```bash
docker stop prometheus grafana node-exporter cadvisor
```

`docker stop` 会打印每个被停掉的容器名（输出里的字段以你本机实际输出为准）。四个名字全部命中才不会中断。

> 名字从哪里来？`docker ps` 的最后一列（列名请以你本机实际输出为准）。如果你用的是 compose 里 `container_name` 指定的名字，就正好是这四个；如果你前面课是手敲 `docker run --name xxx` 起的，**以你当时起的名字为准**。

### 步骤 4：按本节方法——再 rm

```bash
docker rm prometheus grafana node-exporter cadvisor
```

同样是一条命令带四个名字。到这一步，容器记录（可写层、网络命名空间、进程）都没了。

### 步骤 5：验证（课里没讲，但必须做）

```bash
docker ps -a
```

**期望结果：列表里不再出现这四个名字。** 如果某个名字还在，只有两种可能：名字打错了，或者它当时是 running 状态被 `rm` 拒了（`rm` 只删已停止的容器，除非加 `-f`——**`-f` 本节没讲**）。

### 步骤 6：可选——把镜像和数据卷也回收（课里没讲）

```bash
docker image ls
docker volume ls
docker system df
```

- 镜像还在：`docker rm` 不删镜像，想删要 `docker rmi <镜像名>`。
- 卷还在：`docker rm` **不删命名卷**。如果按第 4 节的 compose 文件起的，会有 `prometheus-data`、`grafana-data` 两个卷，名字前面带项目名前缀。

### 一条命令走完（推荐做法）

把步骤 3–5 收进脚本：

```bash
chmod +x cleanup.sh cleanup-safe.sh
./cleanup.sh          # 完全复刻讲师的写法，出错就停
# 或
./cleanup-safe.sh     # 忠实复刻意图，容忍“容器本来就没了”
```

---

## 4. 完整代码

### 4.1 `docker-compose.yml`（补充脚手架，本节未讲）

```yaml
# 文件路径: ~/prom-grafana-lab/docker-compose.yml
# 用途: 起一套和课程一致的 Prometheus + Grafana + node-exporter + cAdvisor
# 说明: 本节（P017）只讲清理，不讲怎么起。本文件是为了让你能"先起再拆"。

services:
  prometheus:
    image: prom/prometheus:v2.51.2
    container_name: prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus-data:/prometheus
    command:
      - "--config.file=/etc/prometheus/prometheus.yml"
      - "--storage.tsdb.path=/prometheus"
    restart: unless-stopped

  grafana:
    image: grafana/grafana:10.4.2
    container_name: grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana-data:/var/lib/grafana
    depends_on:
      - prometheus
    restart: unless-stopped

  node-exporter:
    image: prom/node-exporter:v1.7.0
    container_name: node-exporter
    ports:
      - "9100:9100"
    pid: host
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - "--path.procfs=/host/proc"
      - "--path.sysfs=/host/sys"
      - "--path.rootfs=/rootfs"
    restart: unless-stopped

  cadvisor:
    image: gcr.io/cadvisor/cadvisor:v0.49.1
    container_name: cadvisor
    ports:
      - "8080:8080"
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker/:ro
      - /dev/disk/:/dev/disk/:ro
    privileged: true
    restart: unless-stopped

volumes:
  prometheus-data:
  grafana-data:
```

### 4.2 `prometheus.yml`（补充脚手架，本节未讲）

```yaml
# 文件路径: ~/prom-grafana-lab/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: "prometheus"
    static_configs:
      - targets: ["localhost:9090"]

  - job_name: "node-exporter"
    static_configs:
      - targets: ["node-exporter:9100"]

  - job_name: "cadvisor"
    static_configs:
      - targets: ["cadvisor:8080"]
```

### 4.3 `cleanup.sh`（严格复刻本节写法）

```bash
#!/usr/bin/env bash
# 文件路径: ~/prom-grafana-lab/cleanup.sh
# 严格照 P017 讲师口播的写法：先 stop 四个名字，再 rm 四个名字。
# 特性：任何一个名字不存在，命令失败，脚本立刻退出（set -e）。
# 这正好用来暴露"你名字打错了"。

set -euo pipefail

CONTAINERS=(prometheus grafana node-exporter cadvisor)

echo "==> [1/3] 拆除前，机器上的容器："
docker ps -a

echo "==> [2/3] docker stop ${CONTAINERS[*]}"
docker stop "${CONTAINERS[@]}"

echo "==> [3/3] docker rm ${CONTAINERS[*]}"
docker rm "${CONTAINERS[@]}"

echo "==> [4/4] 拆除后，机器上的容器："
docker ps -a

echo "==> 完成：四个监控容器已停止并删除"
```

### 4.4 `cleanup-safe.sh`（忠实复刻意图，容忍“本来就没了”）

```bash
#!/usr/bin/env bash
# 文件路径: ~/prom-grafana-lab/cleanup-safe.sh
# 和 cleanup.sh 的区别：先判断存在性，再决定 stop / rm。
# 适合你反复跑（讲师说他在重启 Prometheus 时重复过好几次这套操作）。

set -uo pipefail

CONTAINERS=(prometheus grafana node-exporter cadvisor)
REMOVED=()
SKIPPED=()

# 判断容器是否存在（包括已停止的）
exists() {
  docker ps -a --format '{{.Names}}' | grep -qx "$1"
}

echo "==> 开始清理监控容器"

for name in "${CONTAINERS[@]}"; do
  if ! exists "$name"; then
    echo "    [跳过] $name 不存在"
    SKIPPED+=("$name")
    continue
  fi

  # 先停（已停止的容器再 stop 会直接返回，不报错）
  if docker stop "$name" >/dev/null 2>&1; then
    echo "    [已停止] $name"
  else
    echo "    [停止失败] $name（继续尝试删除）"
  fi

  # 再删
  if docker rm "$name" >/dev/null 2>&1; then
    echo "    [已删除] $name"
    REMOVED+=("$name")
  else
    echo "    [删除失败] $name"
  fi
done

echo
echo "==> 汇总"
echo "    已删除: ${REMOVED[*]:-无}"
echo "    已跳过: ${SKIPPED[*]:-无}"

echo
echo "==> 验证：下面标题应为空"
echo "--- 仍在运行的容器 ---"
docker ps
echo "--- 全部容器（含已停止）---"
docker ps -a
```

---

## 5. 逐行解释

### 5.1 compose 文件里和“清理”相关的几行

- `container_name: prometheus` / `grafana` / `node-exporter` / `cadvisor`
  这四行决定了你 `docker stop` 后面**该敲什么**。没有 `container_name` 时，compose 会生成 `<项目名>-<服务名>-<序号>` 这种名字，讲师口播的四个短名字就对不上——这也是很多人照着敲报 “No such container” 的根因。**在 JS 里对应什么**：相当于你 `npm run dev` 起服务后，`package.json` 里的 `name` 字段决定不了进程名，真正决定你 `kill` 哪个 PID 的是你启动时的标识；名字对不上就杀不到。

- `volumes: - prometheus-data:/prometheus`
  这是**命名卷**，不是宿主机目录。它的生命周期独立于容器：`docker rm` 删容器，卷还在。**这直接决定了“清理”到底清不干净。**

- `- ./prometheus.yml:/etc/prometheus/prometheus.yml:ro`
  这是**绑定挂载**，`:ro` 是只读。文件本体在你磁盘上，容器删了文件还在。想彻底清掉得手动 `rm prometheus.yml`。

- `restart: unless-stopped`
  这行很关键：如果没先 `docker stop` 就直接 `docker rm -f`，配合 restart 策略会出现“删了又起来”的错觉（实际上是别的容器/别的编排在拉）。**`stop` 先行的第二个理由。**

### 5.2 `cleanup.sh`

```bash
set -euo pipefail
```
- `-e`：任何命令返回非 0 就退出。所以如果 `prometheus` 这个名字不存在，`docker stop` 失败，脚本直接在“停”这一步断掉，**不会**进行到“删”。这是刻意设计的——让你看到错误，而不是静默跳过。**JS 类比**：相当于 `await` 一个 reject 的 Promise 且没有 `try/catch`，整条链路直接抛。
- `-u`：引用未定义变量报错。
- `pipefail`：管道里任一环节失败即视为失败。

```bash
CONTAINERS=(prometheus grafana node-exporter cadvisor)
```
bash 数组。**JS 类比**：`const CONTAINERS = ['prometheus','grafana','node-exporter','cadvisor']`。

```bash
docker stop "${CONTAINERS[@]}"
```
`"${ARR[@]}"` 会把数组展开成四个独立参数，等价于讲师原话的 `docker stop prometheus grafana node-exporter cadvisor`。**必须加引号**，不加引号在名字含空格时会炸（虽然容器名不含空格，但这是好习惯）。

```bash
docker rm "${CONTAINERS[@]}"
```
**注意这里没有 `-f`。** 因为上一步已经 `stop` 过了，容器处于 stopped 状态，`rm` 可以正常工作。**`stop` → `rm` 的顺序就是本节的唯一技术要点。**

### 5.3 `cleanup-safe.sh`

```bash
exists() {
  docker ps -a --format '{{.Names}}' | grep -qx "$1"
}
```
- `docker ps -a`：列出**所有**容器，包括已停止的。只写 `docker ps` 会漏掉已停止的容器，你会误判“已经没了”然后 `rm` 时才发现还在。
- `--format '{{.Names}}'`：只输出名字一列。`{{.Names}}` 是 docker CLI 的 Go 模板占位符，**可用字段以 `docker ps --help` 或官方文档为准**。
- `grep -qx "$1"`：`-q` 静默（只要退出码），`-x` 整行精确匹配。**必须是 `-x`**，否则 `prometheus` 会匹配到 `prometheus-node-exporter` 这种前缀相同的名字。

```bash
if docker stop "$name" >/dev/null 2>&1; then
```
`>/dev/null 2>&1` 丢掉 stdout 和 stderr，只留退出码判断。**JS 类比**：`try { await fn() } catch { /* 忽略 */ }` 后看 boolean。

```bash
echo "    已删除: ${REMOVED[*]:-无}"
```
`${VAR[*]:-无}` 是“数组为空时输出 `无`”。不加这个，空数组会展开成空字符串。

**关于并发/事务的那句话**：这套脚本**没有事务语义**。如果它在 `stop` 完 `prometheus`、还没 `rm` 的时候被 Ctrl+C 打断，你会得到一个中间状态（prometheus 已停未删，其余三个还在跑）。**对前端来说**：这就像你用 `Promise.all` 批量删资源，其中一个 reject 了其他几个照样删掉了——没有回滚。想更稳，就在脚本末尾多跑一次 `docker ps -a` 自行核对，或者干脆用 `docker compose down`（见第 7 节）。

---

## 6. 复现检查清单

照着打勾，全绿才算复现完本节：

- [ ] `docker version` 和 `docker compose version` 都有输出，没有 “command not found”
- [ ] `~/prom-grafana-lab/` 下存在 `docker-compose.yml`、`prometheus.yml`、`cleanup.sh`、`cleanup-safe.sh` 四个文件
- [ ] `docker compose up -d` 后 `docker compose ps` 能看到 4 个服务
- [ ] `docker ps` 的容器名里能**逐字**找到 `prometheus`、`grafana`、`node-exporter`、`cadvisor`（名字不一致就改脚本里的数组）
- [ ] 浏览器打开 `http://localhost:9090` 能看到 Prometheus 界面（说明确实在跑）
- [ ] `./cleanup.sh` 执行完毕，最后没有红色报错退出
- [ ] `docker ps -a` 的结果里**不再出现**这四个名字
- [ ] `docker volume ls` 里仍然能看到 `prom-grafana-lab` 前缀的数据卷（**这是正常的**，`rm` 不删卷）
- [ ] `docker image ls` 里四个镜像还在（**也是正常的**，`rm` 不删镜像）
- [ ] 再跑一次 `./cleanup-safe.sh`，四个容器全部显示 `[跳过] xxx 不存在`，不报错——说明脚本幂等
- [ ] 你能用一句话说清：为什么必须 `stop` 在前、`rm` 在后

---

## 7. 课里没讲但你会撞上的

这一节是“你自己动手时真正会卡住的地方”。讲师没讲，我补上，并明确标注。

**① `docker rm` 会删不干净：卷和镜像都在。**
`docker rm` 只删容器，命名卷（`prometheus-data`、`grafana-data`）和镜像留在磁盘上。想连卷一起删：`docker volume ls` 找到名字后 `docker volume rm <卷名>`。**课里没讲 `docker volume rm`。** 用 compose 的话是 `docker compose down -v`（`-v` 表示连卷一起删）——**课里也没讲。**

**② 如果你是 `docker compose up -d` 起的，优先用 `docker compose down`。**
手动 `docker rm` 之后，compose 还“记得”这个项目（网络、卷仍在），`docker compose ps` 的状态会变得难以解释。`docker compose down` 会按依赖顺序停、删容器并移除默认网络，更接近“干净”。**课里只讲了 `docker stop` + `docker rm`，没讲 `docker compose down`。**

**③ `docker stop` 不是立刻 kill。**
默认先发终止信号，给进程一段时间优雅退出，超时才强杀。Prometheus 需要时间 flush 内存里的数据块——这就是为什么**不能直接 `rm -f` 跳过 `stop`**，你可能丢掉最后一段指标。具体默认宽限期秒数请以 `docker stop --help` 实际输出为准，**课里没讲这个数字**。**JS 类比**：相当于 `server.close()` 等待在途请求结束，而不是 `process.exit(0)`。

**④ 端口占用：3000 最容易被你自己的前端项目占掉。**
`grafana` 用 3000，这是 Vite/Next/CRA 的默认端口。起来失败就改宿主机端口：`"3001:3000"`。同理 9090、9100、8080 也常冲突。**课里没讲端口冲突处理。**

**⑤ 在 macOS / Windows Docker Desktop 上，node-exporter 和 cAdvisor 采到的不是你本机。**
它们采的是 Docker 那个 Linux 虚拟机。你会看到 Grafana 里 CPU 曲线“很平滑、不像我的机器”——不是你配错了，是架构如此。**课里没讲这一点。**

**⑥ cAdvisor 需要特权，Windows 上基本跑不起来。**
`privileged: true` 加 `/var/lib/docker` 挂载，在 Windows 的 Docker Desktop 上常见结果是容器起不来或数据为空。**课里没讲跨平台差异。**

**⑦ 名字对不上就全盘失败。**
`docker stop` 是**一次性校验所有名字**的：四个里有一个不存在，整条命令报错，前面几个也不会被停。这是 `cleanup.sh` 会中途退出的原因，也是 `cleanup-safe.sh` 存在的理由。**课里没讲失败处理。**

**⑧ 讲师列的技术栈里有两个词是转写误差。**
口播里的 “recording crews” / “writing crews” 应为 **recording rules** / **alerting rules**；“GenX” 疑为 **nginx**。这些是转写产物，不是讲师编的新名词。**具体怎么配 recording rules / alerting rules，课里没讲代码，只提了名字。**

**⑨ Thanos / Cortex / Mimir 只被点名，没有安装步骤。**
本节提到它们只为了解决“按月/按年保留指标”这个需求。**怎么部署、怎么和现有 Prometheus 对接，课里没讲。**

**⑩ 这套栈和你的前端项目的关系。**
它不是 dev server 之外的“又一个服务器”，它是**观测面**：Prometheus 定时来你的服务上“抓一次数字”（scrape），Grafana 把这些数字画出来。你的 AI 应用想被监控，就得自己暴露一个返回数字的 HTTP 端点（这就是“exporter”的本质）——**具体怎么写这个端点，本节没讲**，属于第 2 节路线一里“set up Prometheus and Grafana for your own applications”要做的事。

---

**最后一句话总结本节**：这门课的技术内容在前 16 节已经讲完，P017 的价值是**让你把机器收干净、并且知道下一步练什么**。清理只有两步：`docker stop` 四个名字，`docker rm` 四个名字；顺序不能反，卷和镜像不会跟着走，这两点记住就够了。

![p017 02:21 讲师道谢并推荐后续课程，本节技术内容到此结束](images/p017_0141s.jpg)