# Docker & Kubernetes Zero to Hero（BV1XHTu6eEgy）P15–P20：把 MongoDB 做成有状态的 StatefulSet

> 本节范围：P015–P020。逐字稿里讲师明确说，Color API 的代码改造放在后续课时，这 6 集只做**数据库侧**：Secret、ConfigMap、Headless Service、StatefulSet、PVC，以及扩缩容时持久化的真实行为。
> 因此本文的“完整代码”是 5 个可以直接 `kubectl apply` 的 YAML 文件，不是 API 代码。文末第 7 节会给出 Node 侧怎么连上去（明确标注“课里没讲，示意”）。

---

## 1. 这一节做什么

一句话：**在 minikube 的 default 命名空间里跑起一个带认证、带初始化脚本、数据落在持久卷上的 MongoDB，并亲手验证“Pod 重建数据还在、Pod 扩容数据不共享”这两件事。**

拆成可验收的目标：

| 目标 | 交付物 | 验收方式 |
| --- | --- | --- |
| 数据库有 root 凭据，且与业务凭据分开管理 | 2 个 Secret | `kubectl get secret` 能看到两条 |
| 首次启动自动建一个只有 colordb 读写权限的用户 | 1 个 ConfigMap（内含 `mongo-init.js`） | `kubectl logs` 里能看到脚本自己打的日志 |
| Pod 之间能通过稳定网络标识互相找到 | 1 个 Headless Service（`clusterIP: None`） | `kubectl get svc` 里 CLUSTER-IP 为 None |
| 数据不随 Pod 消失 | StatefulSet + `volumeClaimTemplates` | 删 Pod 后重建，数据仍在 |
| 每个副本有自己独立的盘 | 每 Pod 一个 PVC | 扩到 3 副本后，第 2 个 Pod 查不到第 1 个 Pod 的数据 |

最终目录结构（文件名是讲师口述的，我按他说的命名习惯落地；**名字本身可以改，但文件内部的引用必须自洽**）：

```
mongodb/
├── rootcreds.yaml          # Secret：MongoDB root 凭据
├── colordb-creds.yaml      # Secret：colordb 业务用户凭据
├── mongo-init-db.yaml      # ConfigMap：初始化脚本 mongo-init.js
├── mongodb-svc.yaml        # Service：headless
└── mongodb-ss.yaml         # StatefulSet：真正的数据库负载
```

环境要求（讲师在课里用的组合）：

- minikube 已启动，集群里存在 minikube 自带的 **standard** StorageClass（讲师原话是“the standard storage class that is provided by Minikube for us”，用来动态创建 hostPath 卷）。
- `kubectl` 能连上该集群。
- 镜像 `mongo:8.0.0` 能拉下来（讲师提到他本地已经有镜像，所以 Pod 起得很快；你第一次跑会花时间下载）。

---

## 2. 讲师原话

> "在这个项目中，我们将部署一个 MongoDB StatefulSet，并更新我们的颜色 API，以便从数据库中恢复颜色信息。"
> —— p015 [00:00]

> "我们将部署一个 MongoDB StatefulSet，配合一个无头 Service，使通信能够到达 StatefulSet 底层的各个 Pod。这个 StatefulSet 能够读取我们创建的 ConfigMap 和 Secret，并且它还应当利用 Minikube 集群中默认或标准的 StorageClass 来创建 PersistentVolumeClaim。"
> —— p015 [01:04]

![p015 01:13 讲师讲解 MongoDB StatefulSet、headless service 与 PVC 的整体关系图](images/p015_0073s.jpg)

> "每当你向 /api 发送 GET 请求时，应当能够通过查询 URL 参数提供颜色键……如果所提供的键对应的颜色不存在，API 应返回 404。"
> —— p015 [01:56]

> "在真实环境中，你绝不会把这个文件提交到代码仓库……你要么通过 kubectl 命令行创建它们，要么把它们存放在外部的密钥方案中，比如 Vault 或 Secrets Manager。"
> —— p016 [02:31]

> "从集群管理者的角度想一想……那个人大概不会愿意把 root 凭据的访问权限开放给所有人。"
> —— p016 [04:08]

![p016 02:02 讲师在编辑器里写 Secret 文件，把用户名密码以 base64 形式放进 data 字段](images/p016_0114s.jpg)

> "我认为你可以随意命名这个文件，只要扩展名是 .js 就行……Mongo 会识别它，并在数据库启动时执行它。"
> —— p017 [00:51]

> "它确实需要与这里 metadata.name 下的 Service 名称保持一致。"
> —— p018 [00:47]

> "我自己就遇到过这种情况：当我们把这个空间设置得太小时，MongoDB 的系统数据实际上已经占用了这个存储的大部分甚至全部。"
> —— p018 [02:15]

> "它必须正好是这个路径，否则 Mongo 进程将无法识别初始化脚本，也就不会执行它们。"
> —— p018 [08:57]

![p018 06:08 讲师配置 StatefulSet 的 volumes 与 volumeMounts，把 ConfigMap 挂成初始化脚本目录](images/p018_0368s.jpg)

> "所以这实际上正是 StatefulSet 的预期行为。"
> —— p020 [02:10]（解释第二个 Pod 查不到第一个 Pod 的数据）

> "当 StatefulSet 中的 Pod 被删除时，有些东西默认不会被删除，那就是 PersistentVolumeClaim。"
> —— p020 [05:15]

---

## 3. 从零复现

### 步骤 0：确认集群与 StorageClass

```bash
minikube start
kubectl get nodes
kubectl get storageclass
```

你需要在 StorageClass 列表里看到 `standard`（名字要和后面 YAML 里的 `storageClassName` 对上；你的集群里如果叫别的名字，就改 YAML，别改集群）。

### 步骤 1：建目录

```bash
mkdir -p ~/docker-k8s/mongodb
cd ~/docker-k8s/mongodb
```

讲师第一步就是“create a new folder here as usual so that we have all the files under the same folder and no confusion with previous projects”。

![p016 00:13 讲师在 IDE 里新建本节项目目录，准备放 Mongo 相关清单文件](images/p016_0013s.jpg)

### 步骤 2：先算 base64，再写 Secret

这一步顺序很重要：先算出编码值，再往 YAML 里贴。讲师特意强调用 `echo -n`（`-n` = 不输出行尾换行），因为“echo prints a new line character by default here and this can lead to some problems when using these values with Mongo”。

```bash
echo -n 'root_user'     | base64
# cm9vdF91c2Vy
echo -n 'root_password' | base64
# cm9vdF9wYXNzd29yZA==

echo -n 'colordb_user'     | base64
# Y29sb3JkYl91c2Vy
echo -n 'colordb_password' | base64
# Y29sb3JkYl9wYXNzd29yZA==
```

> 注意：如果你在 Windows 的 PowerShell/CMD 里，`echo -n` 不存在，请用 `printf 'root_user' | base64`（Git Bash / WSL）或 `[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('root_user'))`。**千万别把行尾换行编进去**，否则后面 `db.auth()` 会失败，而且报错信息不会告诉你“你多了个 \n”。

![p016 01:46 讲师在 IDE 内置终端里用 echo -n 管道到 base64，生成 Secret 需要的编码字符串](images/p016_0114s.jpg)

### 步骤 3：写 5 个文件

按第 4 节的完整内容，依次创建 `rootcreds.yaml`、`colordb-creds.yaml`、`mongo-init-db.yaml`、`mongodb-svc.yaml`、`mongodb-ss.yaml`。

### 步骤 4：先 apply Secret + ConfigMap + Service（不含 StatefulSet）

讲师的做法是直接 `kubectl apply -f .` 把目录里已有的文件全应用一遍：

```bash
kubectl apply -f .
kubectl get secret
kubectl get configmap
kubectl get svc
```

他特别提到一句顺序上的因果关系：“The secret must exist before we actually create the stateful set.” 先建 Secret，Pod 启动时才不会因为 `secretKeyRef` 找不到对象而卡在 `CreateContainerConfigError`。

![p019 00:13 终端里逐个确认 Service、ConfigMap、Secret 都已创建成功](images/p019_0013s.jpg)

### 步骤 5：apply StatefulSet 并等它跑起来

```bash
kubectl apply -f mongodb-ss.yaml
kubectl get pods -w
```

讲师现场看到的是很快就 Running（因为他本地已有镜像）。你如果卡在 `ContainerCreating`，大概率在拉 `mongo:8.0.0`，耐心等或先 `minikube ssh` 里验证网络。

### 步骤 6：确认卷真的创建并绑定上了

```bash
kubectl describe pod mongodb-ss-0
kubectl get pvc
kubectl get pv
```

讲师在这一步的观察点是：“we can confirm that we have our MongoDB data, the persistent volume claim is here. We have also our config map.”

![p019 01:28 讲师 describe Pod，确认 Volume/卷挂载与 ConfigMap 都已生效](images/p019_0088s.jpg)

### 步骤 7：在日志里找初始化脚本的输出

```bash
kubectl logs mongodb-ss-0 | grep -i init
```

MongoDB 自身日志很多且格式统一（讲师说“there are quite a few key value pairs here… MongoDB has very good documentation around the meaning of this logs”），所以在里面搜 `init` 最快。你能搜到的是 **你自己脚本里 `console.log` 打的字**，这就证明 `/docker-entrypoint-initdb.d` 里那个文件被执行了。

### 步骤 8：进容器验证认证与权限

```bash
kubectl exec -it mongodb-ss-0 -- mongosh
```

进去后按讲师的顺序操作：

```js
show dbs            // 报错：需要认证（这一步报错是好事，说明没裸奔）
use admin
db.auth("root_user", "root_password")   // ok: 1
show dbs                                 // 现在能看到库列表
use colordb
db.auth("colordb_user", "colordb_password")  // ok: 1
db.testcollection.insertOne({ hello: "world" })
db.testcollection.find()                     // 能查回自己刚插的文档
use someother
db.testcollection.find()                     // unauthorized：越权被拒
```

讲师对这一步的结论是：“the color DB user is authorized to write only to the color DB database… this will also give more security around making sure that the applications will interact only with the intended database.”

![p019 02:44 进入 mongosh 后 show dbs 被拒绝，说明 root 认证已生效](images/p019_0164s.jpg)

### 步骤 9：扩容，观察“数据不共享”

```bash
kubectl scale statefulset mongodb-ss --replicas=3
kubectl get pods
kubectl exec -it mongodb-ss-1 -- mongosh
```

在 `mongodb-ss-1` 里重复认证流程后执行 `db.testcollection.find()`：**返回空**。讲师的原话是 “the moment we do that, we actually get nothing back. So this is actually the expected behavior of our stateful sets.”

再验证底层：

```bash
kubectl get pvc
minikube ssh
# 进到 minikube 虚拟机后：
cd /tmp/hostpath-provisioner/default
ls
```

你会看到和 PVC 数量一致的目录，彼此独立，谁也不共享（课程里没有开启 MongoDB 副本集复制，讲师明确说复制“is not enabled by default”）。

![p020 02:12 扩容到 3 个 Pod 后逐个 exec 验证，第二个 Pod 查不到第一个 Pod 的数据](images/p020_0132s.jpg)

### 步骤 10：删 Pod，验证“稳定存储身份”

```bash
kubectl delete pod mongodb-ss-0
kubectl get pods
kubectl exec -it mongodb-ss-0 -- mongosh
```

重新认证后 `db.testcollection.find()` **数据还在**。讲师说这正是 StatefulSet 的价值：“due to this stable storage identity that we get from Stateful Sets… even if the pod enters into a crashed state or it is restarted for whatever reason or deleted and recreated.”

### 步骤 11：缩容不等于删数据

```bash
kubectl scale statefulset mongodb-ss --replicas=1
kubectl get pvc     # 另外两个 PVC 还在！
```

讲师原话：“something that is not deleted by default whenever pods in a stateful set are deleted, and these are the persistent volume claims.”

要真正清掉，得手删 PVC（注意他现场先打错成 `pv` 又纠正为 `pvc`）：

```bash
kubectl delete pvc <第二个PVC名> <第三个PVC名>
kubectl get pv            # 对应的 PV 一起消失
minikube ssh
cd /tmp/hostpath-provisioner/default && ls   # 目录也只剩一个
```

![p020 04:39 删掉多余 PVC 后，hostPath 目录只剩第一个 Pod 的那份数据](images/p020_0249s.jpg)

### 步骤 12：整门课的清理

```bash
kubectl delete -f .
kubectl get pvc        # 若还有残留 PVC，手动 delete
```

---

## 4. 完整代码

> 以下 5 个文件可直接保存到 `mongodb/` 目录并 `kubectl apply -f .`。
> 说明：讲师口述了每个字段的**含义**，但没逐字念出完整缩进；我按 Kubernetes 的正确结构补全了缩进与 `apiVersion`。文件内互相引用的名字（Secret 名、ConfigMap 名、Service 名、卷名）必须一一对应，改一个就要改全部。

### 4.1 `rootcreds.yaml`

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: mongodb-root-creds
  labels:
    app: mongodb
type: Opaque
data:
  # echo -n 'root_user' | base64
  username: cm9vdF91c2Vy
  # echo -n 'root_password' | base64
  password: cm9vdF9wYXNzd29yZA==
```

### 4.2 `colordb-creds.yaml`

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: mongodb-colordb-creds
  labels:
    app: mongodb
type: Opaque
data:
  # echo -n 'colordb_user' | base64
  username: Y29sb3JkYl91c2Vy
  # echo -n 'colordb_password' | base64
  password: Y29sb3JkYl9wYXNzd29yZA==
```

### 4.3 `mongo-init-db.yaml`

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: mongodb-init-colordb
  labels:
    app: mongodb
data:
  mongo-init.js: |
    db = db.getSiblingDB(process.env.DB_NAME);
    console.log("initializing database: " + process.env.DB_NAME);
    console.log("creating user: " + process.env.DB_USER);

    db.createUser({
      user: process.env.DB_USER,
      pwd: process.env.DB_PASSWORD,
      roles: [
        { role: "readWrite", db: process.env.DB_NAME }
      ]
    });

    console.log("initialization success");
```

### 4.4 `mongodb-svc.yaml`

```yaml
apiVersion: v1
kind: Service
metadata:
  name: mongodb-svc
  labels:
    app: mongodb
spec:
  clusterIP: None          # 关键：headless service
  selector:
    app: mongodb           # 注意是 mongodb，不是 colordb
  ports:
    - port: 27017
      targetPort: 27017
```

### 4.5 `mongodb-ss.yaml`

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mongodb-ss
  labels:
    app: mongodb
spec:
  serviceName: mongodb-svc     # 必须等于 Service 的 metadata.name
  replicas: 1
  selector:
    matchLabels:
      app: mongodb
  template:
    metadata:
      labels:
        app: mongodb
    spec:
      containers:
        - name: mongo
          image: mongo:8.0.0
          ports:
            - containerPort: 27017
          env:
            - name: MONGO_INITDB_ROOT_USERNAME
              valueFrom:
                secretKeyRef:
                  name: mongodb-root-creds
                  key: username
            - name: MONGO_INITDB_ROOT_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: mongodb-root-creds
                  key: password

            - name: DB_NAME
              value: colordb
            - name: DB_USER
              valueFrom:
                secretKeyRef:
                  name: mongodb-colordb-creds
                  key: username
            - name: DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: mongodb-colordb-creds
                  key: password
          volumeMounts:
            - name: mongodb-data
              mountPath: /data/db
            - name: mongodb-init-config
              mountPath: /docker-entrypoint-initdb.d   # 必须一字不差
      volumes:
        - name: mongodb-init-config
          configMap:
            name: mongodb-init-colordb
  volumeClaimTemplates:
    - metadata:
        name: mongodb-data
      spec:
        accessModes:
          - ReadWriteOnce
        storageClassName: standard
        resources:
          requests:
            storage: 10Gi
```

### 4.6 一键复现脚本（命令清单，不是课程内容）

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

kubectl apply -f rootcreds.yaml
kubectl apply -f colordb-creds.yaml
kubectl apply -f mongo-init-db.yaml
kubectl apply -f mongodb-svc.yaml
kubectl apply -f mongodb-ss.yaml

kubectl rollout status statefulset/mongodb-ss --timeout=300s
kubectl get pods,pvc,svc
kubectl logs mongodb-ss-0 | grep -i init || true
```

---

## 5. 逐行解释

### Secret 部分

- `type: Opaque`：通用键值型 Secret，讲师明确说“The type will be opaque”。另外两种常见的内置类型（docker-registry、tls）这里用不到。
- `data:` 下必须是 base64；如果嫌麻烦，Kubernetes 也支持 `stringData:` 直接写明文（讲师也提了：“We can also use string data like so to simply pass the username and the password here in plain text”），但 base64 写法的好处是**读代码的人一眼就知道这是二进制敏感值**，不容易被当成普通配置复制走。
- `username` / `password` 这两个 key 名会被 StatefulSet 里的 `secretKeyRef.key` 精准引用，改名就断链。
- **为什么拆成两个文件**：讲师花了将近两分钟解释，核心是 RBAC 粒度——“谁需要访问 root 凭据”、“谁需要访问 colordb 凭据”是两个不同的人群。放在一个文件里就没法分别授权。
- **前端视角**：这相当于你在 Node 里用 `.env` + `process.env.DB_PASSWORD`，只不过值的来源从 `.env` 文件换成了集群里的 Secret，注入方式换成了 `env.valueFrom`。区别是 `.env` 泄露只影响一台机器，Secret 泄露影响整个集群，所以权限模型必须提前设计。

### Secret 的编码值怎么来的

- `echo -n` 的 `-n` 是本节最容易踩的小坑。`echo 'root_user' | base64` 会把 `\n` 一起编进去，得到 `cm9vdF91c2VyCg==`，而 MongoDB 拿到这个密码后，`db.auth()` 永远对不上。**症状是“密码明明对但认证失败”**，极难排查。

### ConfigMap / 初始化脚本

- `data.mongo-init.js`：key 就是**文件名**，value 就是**文件内容**。讲师讲得很清楚：“the key will be the name of the file and the contents of this key, the value of this key, will be the contents of the file.”
- 后缀必须是 `.js`，因为 MongoDB 的 entrypoint 只执行 `.js`（讲师：“as long as it is dot js… here is a JavaScript file”）。课里没有具体讲除 `.js` 外还支持哪些后缀，此处不臆测。
- `db.getSiblingDB(process.env.DB_NAME)`：切到目标库。不切的话 `db.createUser` 会把用户建在 `test` 库上。
- `roles: [{ role: "readWrite", db: process.env.DB_NAME }]`：这是 p019 里那次“越权被拒”实验的根因——用户只在 colordb 上有读写权，所以 `use someother` 之后 `find` 直接 unauthorized。
- **为什么不把库名硬编码在脚本里**：讲师的理由是复用性——“this is a fairly general or generic script, it's not really coupled to the color db database”。所以库名、用户名、密码全部走环境变量，脚本本身与具体业务解耦。
- 讲师自己也提醒了：这是纯文本，编辑器没有 JS 语法高亮。他的做法是复制到临时文件 `temp.js` 里检查有没有语法错误和变量拼写问题，然后删掉。

### Service

- `clusterIP: None` 是 headless 的判定标志。普通 Service 会给你一个虚拟 IP 做四层转发；headless 不分配 VIP，DNS 查询直接返回 Pod 的地址集合——StatefulSet 需要的就是这个（讲师的原话是“allows communication to the underlying pods of our stateful set”）。
- `selector.app: mongodb` 必须和 StatefulSet 的 `template.metadata.labels.app` 一致，否则 Service 没后端。
- 只开 `27017`，因为这是 MongoDB 默认监听端口（讲师：“which is the port where MongoDB listens by default”）。
- **前端视角**：普通 Service ≈ 一个带负载均衡的域名；headless ≈ 你直接拿到实例列表。后者是有状态服务的必需能力，因为“连到任意一个副本”在数据库语义下是不成立的。

### StatefulSet

- `serviceName: mongodb-svc`：讲师专门强调“It does need to match the name of the service here under metadata.name”。写错不会报错，只会导致 Pod 缺少稳定的网络标识，问题会延后到应用联调时才爆发。
- `replicas: 1`：先单副本验证，后面再 scale。
- `selector.matchLabels` 与 `template.metadata.labels` 必须一致，这是 StatefulSet 管理 Pod 的唯一依据。
- `image: mongo:8.0.0`：**固定版本**。用 `latest` 会导致“今天能跑明天不能跑”，课后你要复现就必须钉版本。
- `MONGO_INITDB_ROOT_USERNAME` / `MONGO_INITDB_ROOT_PASSWORD`：这两个名字是 MongoDB 官方镜像硬约定，讲师说“it has to be named like this, otherwise Mongo will not pick this up”。拼错一个字母，root 用户就不会被创建。
- `DB_NAME` / `DB_USER` / `DB_PASSWORD`：这三个是**讲师自己起的名字**，因为它们是给自己写的初始化脚本用的，不是镜像约定。名字随便起，只要 `mongo-init.js` 里的 `process.env.XXX` 对得上。
- `volumeMounts`：
  - `mountPath: /data/db`：MongoDB 默认数据目录，卷挂到这里才算真正持久化。
  - `mountPath: /docker-entrypoint-initdb.d`：讲师强调“It needs to be exactly this path here, otherwise the Mongo process will not identify the initialization scripts and it will not run them.” 这是本节最典型的“静默失败”——路径写错，Pod 照常 Running，只是脚本永远不执行。
- `volumes[].configMap.name`：把 ConfigMap 的每个 key 投影成目录里的一个文件。注意 `volumes` 的缩进层级是 `spec.template.spec` 下、与 `containers` **平级**，讲师专门提示“notice the indentation”。
- `volumeClaimTemplates`：
  - `metadata.name: mongodb-data` 必须与 `volumeMounts[].name` 相同，StatefulSet 才会把生成的 PVC 挂给容器。
  - `accessModes: [ReadWriteOnce]`：同一时刻只能被一个节点挂载。对数据库来说这是安全默认值。
  - `storageClassName: standard`：minikube 自带，负责动态供给 hostPath 卷。集群里没有这个 StorageClass 就会一直 Pending。
  - `storage: 10Gi`：讲师把默认的 1Gi 提到 10Gi，理由是“system data from MongoDB already consumes most if not all of this storage… then we might end up running very quickly into errors”。他还补了一句：磁盘紧张的话“at least four or so would be good”，再低就可能踩坑。
- **PVC 名字怎么来的**：StatefulSet 生成的 PVC 名是“模板名 + StatefulSet 名 + 序号”的组合，具体以你 `kubectl get pvc` 的实际输出为准，不要凭记忆去 `delete`。

### 扩缩容行为（p020 的三条结论）

1. **每个副本一份独立 PVC**：`volumeClaimTemplates` 是模板，不是共享卷。所以 3 副本 = 3 个完全独立的 MongoDB 实例，数据互不可见。
2. **Pod 重建，卷不变**：删掉 `mongodb-ss-0`，新 Pod 还是叫 `mongodb-ss-0`，还是挂回原来那个 PVC，所以数据还在。这就是讲师说的“stable storage identity”。
3. **缩容不删 PVC**：scale 到 1 之后，另外两个 PVC 依然存在并占着 PV。这是特性不是 bug——再次扩到 3 时数据能接上。要真正释放存储，必须显式 `kubectl delete pvc`。

---

## 6. 复现检查清单

按顺序打勾，任何一项不过就别往下走。

**A. 前置**

- [ ] `kubectl get nodes` 至少一个 Ready 节点
- [ ] `kubectl get storageclass` 里存在名为 `standard` 的 StorageClass（名字不同就改 `mongodb-ss.yaml`）

**B. 基础对象**

- [ ] `kubectl get secret` 能看到 `mongodb-root-creds` 和 `mongodb-colordb-creds`
- [ ] `kubectl get configmap` 能看到 `mongodb-init-colordb`
- [ ] `kubectl get svc` 能看到 `mongodb-svc`，且 CLUSTER-IP 显示为 None

**C. StatefulSet 起来了吗**

- [ ] `kubectl get pods` 中 `mongodb-ss-0` 状态 Running（首次可能需要几分钟拉镜像）
- [ ] `kubectl get pvc` 中存在一条与 `mongodb-ss-0` 对应的 PVC，且处于已绑定状态（列名以你的 kubectl 版本实际输出为准）
- [ ] `kubectl get pv` 中能看到对应的 PV
- [ ] `kubectl describe pod mongodb-ss-0` 里能看到 ConfigMap 卷与数据卷都挂上了

**D. 初始化脚本真的跑了吗**

- [ ] `kubectl logs mongodb-ss-0 | grep -i init` 能搜到「initializing database: colordb」和「initialization success」这两行——这是你自己脚本打的字，出现即证明 `/docker-entrypoint-initdb.d` 生效

**E. 认证与权限**

- [ ] `show dbs` 在未认证时**报错**
- [ ] `use admin` + `db.auth("root_user","root_password")` 返回 `1`
- [ ] root 认证后 `show dbs` 能看到库列表
- [ ] `use colordb` + `db.auth("colordb_user","colordb_password")` 返回 `1`
- [ ] `insertOne` 成功，`find()` 能查回
- [ ] 切到别的库执行 `find()` 提示 unauthorized

**F. 持久化语义**

- [ ] `kubectl scale statefulset mongodb-ss --replicas=3` 后 Pod 数变成 3
- [ ] 进 `mongodb-ss-1` 认证后 `find()` 返回空（数据不共享）
- [ ] `minikube ssh` 后 `/tmp/hostpath-provisioner/default` 下有 3 个目录
- [ ] `kubectl delete pod mongodb-ss-0` 后自动重建，数据仍在
- [ ] `--replicas=1` 后 PVC 仍有 3 个
- [ ] 手动删除多余 PVC 后，PV 与 hostPath 目录同步消失

**排错对照表**

| 现象 | 最可能原因 |
| --- | --- |
| Pod 卡 `CreateContainerConfigError` | Secret 名字/key 写错，或 Secret 还没建 |
| Pod 卡 `Pending` | StorageClass 名字不对，或存储请求过大无节点可满足 |
| Pod Running 但没有初始化日志 | `mountPath` 不是 `/docker-entrypoint-initdb.d`，或 ConfigMap key 不以 `.js` 结尾 |
| `db.auth()` 明明密码对却失败 | base64 时混入了换行符（漏了 `echo -n`） |
| 应用连上却看不到 colordb | 用了 root 凭据连到 admin 库，或用户名密码取错了 Secret |

---

## 7. 课里没讲但你会撞上的

1. **初始化脚本只在“数据目录为空”时执行**
   课里只说“它会在数据库启动时被执行”。实际行为是：只要 `/data/db` 里已经有数据，脚本就不会再跑。所以你改了 `mongo-init.js` 之后 `kubectl apply` 一次，是**看不到任何变化**的——必须删掉 Pod 和对应 PVC 让数据目录重新变空。这一点课程没有演示，但它是你调试初始化逻辑时第一个会撞上的墙。

2. **应用连接串怎么写，课里没讲**
   P015 只说了“API 通过 environment variable 拿到数据库连接”，具体连接串、认证库参数都没展开。给一个示意（课里没有这段代码）：

   ```bash
   # 示意，非课程内容
   MONGODB_URI="mongodb://colordb_user:colordb_password@mongodb-svc:27017/colordb?authSource=colordb"
   ```

   注意 `authSource=colordb`：p019 里讲师是“先 `use colordb` 再 `db.auth()`”，等价于在连接串里指定认证库。如果不指定，驱动默认去 `admin` 库认证，会失败。

3. **Node/Express 侧怎么改，课里没讲（属于后续课时）**
   P015 给了完整的 REST 契约（`GET /api?color-key=`、`GET /api/color`、`GET /api/color/:key`、`POST /api/color`、`DELETE /api/color/:key`），也提到会用 Mongoose 处理数据库交互，但**代码一行都没写**。如果你急着联调，注意：StatefulSet 单副本时 MongoDB 是 standalone，不是副本集，连接串里不能加 `replicaSet=`。

4. **Headless Service 的 DNS 长什么样，课里没讲**
   讲师只说它“允许访问底层 Pod”，没有演示 DNS 名称。实际访问时你需要知道 `mongodb-svc` 这个服务名可以解析到 Pod 列表，单个 Pod 也有自己的名称——具体格式请以你集群里 `nslookup` / `getent hosts` 的实际结果为准，别凭印象填。

5. **`storage: 10Gi` 在 minikube 上是稀疏占用**
   10Gi 只是申请量，hostPath 目录不会真的吃掉 10G 物理空间。但也别因此把它设成 100Gi 去“预留”——调度器会按申请量算账。讲师给的经验值（10Gi 舒适、4Gi 起步）已经够用。

6. **生产环境绝不能像课程这样提交 Secret**
   讲师自己说了两遍：他提交到仓库只是为了让你课后能对照代码，真实项目里应该用 `kubectl create secret` 现场创建，或者接外部密钥管理（他提到的 vault / secrets manager）。他提到但**没有演示**用 CLI 创建 Secret 的具体命令，需要你自己查。

7. **数据目录权限**
   `mongo:8.0.0` 官方镜像默认以 `mongodb` 用户运行，hostPath 卷如果权限不对会启动失败。课里没有出现这个问题（minikube 的 hostPath provisioner 处理得比较宽松），但换到云上走块存储时经常撞。遇到 `Permission denied` 就往这个方向查。

8. **多副本 ≠ 高可用**
   p020 里三个 Pod 是**三个独立的数据库**，不是集群。真正的复制需要额外配置 MongoDB 副本集，讲师明确说“there are ways for us to set replication within MongoDB… but this is not enabled by default”。别把“扩到 3 副本”误当成“做了容灾”。

9. **清理别忘了 PVC**
   `kubectl delete -f .` 只删 StatefulSet，PVC 会留下并继续占着 PV 和磁盘。这是 StatefulSet 的设计，也是你本地反复做实验时磁盘被吃满的最常见原因。