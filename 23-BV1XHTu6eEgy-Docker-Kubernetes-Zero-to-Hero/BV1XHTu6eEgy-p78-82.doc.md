# Docker & Kubernetes Zero to Hero — P078–P082 复现文档

> 覆盖范围：把 MongoDB StatefulSet 部署到 GKE、用 node affinity 解决调度失败、部署 Color API Deployment、暴露 LoadBalancer Service、给 API 加 Prometheus 指标并打 2.1.0-dev 镜像。
> 读者定位：前端转 AI 应用工程师。凡涉及后端概念（StatefulSet、PVC、亲和性）都会补一句「在 JS/Node 里对应什么」。

---

## 1. 这一节做什么

这一节把上一阶段在本地跑通的 Color API + MongoDB 应用，真正搬到 Google Cloud 的 GKE（Google Kubernetes Engine）托管集群上。对前端同学来说，可以把它理解成：本地 `npm run dev` 能跑，不等于线上就能稳定跑；这一节做的事，就是把「本地数据库 + 本地 API」换成「云上持久磁盘 + 云上容器 + 公网负载均衡器」。GKE 负责管理 Kubernetes 控制面，你主要写 YAML、执行 `kubectl`，再观察 Pod、PVC、Service 的状态变化。具体做五件事：

1. **写 MongoDB 的 StatefulSet**：用 `apps/v1` 的 StatefulSet 跑 `mongo:8.0.0`，声明资源 requests/limits、从 Secret 注入 root 凭据和业务凭据、挂载初始化脚本 ConfigMap、申请 10Gi 持久卷。StatefulSet 和普通 Deployment 的差别在于：它给 Pod 稳定身份和稳定 DNS，数据库这类需要「名字不变、盘不丢」的工作负载更适合用它。在 JS/Node 里可以类比为：普通 Pod 像临时容器，重启后地址可能变；StatefulSet 的 Pod 像有固定域名的服务实例，重启后仍然能通过同一个名字找到。
2. **用 Kustomize 组织 base + dev/prod overlay**：把 StatefulSet 放进 base，dev/prod 各自只改 namespace。这个结构和前端项目里的「公共组件 + `.env.development` / `.env.production`」很像：base 是共享定义，overlay 是环境差异。课里本节只让 dev/prod 改 namespace，不同环境暂时没有改镜像、副本数或资源，这一点要记住，避免误以为 prod 已经做了完整生产化。
3. **解决 GKE 调度失败**：当请求资源过大、目标 zone 没有可用机器时，用 `nodeAffinity` 把可用 zone 列表放宽，并把资源请求减半。调度失败不是 YAML 语法错误，而是集群里没有满足条件的节点；排查时要先看 `kubectl describe pod` 的 Events，而不是只看 Pod 状态。
4. **部署 Color API Deployment + LoadBalancer Service**：镜像 `lmacademy/color-api:2.0.0`，通过 Secret 注入 DB 凭据，用环境变量拼出 MongoDB 连接串，最后用 LoadBalancer 拿到公网 IP。这里的 Deployment 更像前端静态站点或 Node 服务：无状态、可替换；数据库连接串则像前端请求的 API base URL，只不过这里由环境变量和 Secret 拼出来。
5. **给 API 加 Prometheus 指标并打新镜像**：安装 `express-prom-bundle@7.0.0`，加 metrics 中间件，构建并推送 `2.1.0-dev` 镜像，为下一节「dev 用新版、prod 用稳定版」做铺垫。指标端点相当于给服务加了一个「运行状态仪表盘」入口，后续 Prometheus 可以抓取它。

> 一句话：这一节结束时，你在浏览器里访问一个公网 IP，POST 一个颜色，数据会落到 GKE 上自动创建的 Google Cloud 持久磁盘里。

完成本节后，你应能独立判断三类问题：第一，Pod 为什么 Pending；第二，PVC 为什么没有 Bound；第三，Service 为什么没有 EXTERNAL-IP。每类问题的排查入口不同，不能只反复 `kubectl apply`。下面第 3 节会按操作顺序展开，第 6 节会给每条检查项配上验证方式，第 7 节会把常见坑整理成表格。

---

## 2. 讲师原话（带出处）

- 「Let's now create our stateful set here and deploy this stateful set in our GKE cluster. So the API version will be apps forward slash v1. The kind here will be stateful set.」—— p078 [00:00]
- 「the service name it does need to match what we have specified here. I'm gonna copy the MongoDB-SVC service name from our service file and then place it in our service name here.」—— p078 [00:23]
- 「for the requests here we're going to specify for memory we're going to request four GB bytes and for CPU we will request one VCPU. For the limits here we're just going to double these amounts.」—— p078 [01:33]
- 「the first environment variable is called Mongo underscore init db underscore root underscore username. And the value here will come from a secret.」—— p078 [02:54]
- 「we also have the DB underscore password. And the value for this is coming from the MongoDB color DB credentials.」—— p078 [05:31]
- 「We then need to also update the mount path to be forward slash docker-n3. and make sure you have no typos here, otherwise the script will not be run.」—— p078 [06:27]
- 「let's just run here, kubectl getStorageClass. ... we can go with standard or standard read write ones or if you want to try a more expensive higher performance one you could also go with premium.」—— p078 [06:52]
- 「the name of our volume claim here, we're gonna add MongoDB, so MongoDB-data. The access mode will be read write once. The storage class name will then be standard read write once. And for our request here, we're gonna request 10 GB bytes of data.」—— p078 [08:15]
- 「there were no available machines in the zone that I actually wanted to schedule the spot.」—— p079 [00:00]
- 「One way for us to tackle this problem is to actually allow Google Clara, allow GKE to place the pod in different zones. So we're going to tackle that using the concept of node affinity.」—— p079 [01:17]
- 「the key that we're interested in is topology. ... topology.kubernetes.io forward slash zone. And then here the operator will be in」—— p079 [02:15]
- 「Europe West 4, the region here has three zones. That's Europe West 4A, B and C.」—— p079 [03:13]
- 「Let's say that we want two GB bytes of requests for memory and then four GB bytes of limits. And for CPU here, we can actually try with half of what we are working on.」—— p079 [04:35]
- 「we can see that the pod has triggered a scale up event. ... This is all managed behind the scenes by GKE autopilot.」—— p079 [07:16]
- 「we have received our persistent volume. ... The storage class here is using standard read write ones.」—— p079 [10:35]
- 「the ColorDB credentials is ColorDB user here and the password I'm just gonna copy paste from this string here. ... we should get the message that we are authenticated.」—— p079 [11:25]
- 「the image we will use is going to be our 2.0.0. So LM Academy Ford slash color API 2.0.0.」—— p080 [00:50]
- 「for CPU that will also be 250 millicores. For the limits we're gonna have 128 for megabytes for the memory and 500 for CPU」—— p080 [01:19]
- 「The value here will be MongoDB colon forward slash forward slash and then we will interpolate here the DB user ... mongodb-ss-0 dot and then the name of the service that's going to be mongodb-svc and the part here will be 27017」—— p080 [02:04]
- 「let's just create a service of type load balancer. ... We would like this service to be off type load balancer.」—— p081 [00:00]
- 「Here you will see that the color SVC will show an external IP of pending. And it takes a little bit of time until the load balancer is provisioned in Google Cloud」—— p081 [01:17]
- 「let's install here npm install express dash prom dash bundle. ... the version we will install here will be the version 7.0.0.」—— p082 [00:26]
- 「we need to create a metrics middleware ... let's also include the up endpoint here or the up metric.」—— p082 [01:49]
- 「let's tag this as LM Academy or your username color dash API. And now let's say 2.1.0 dash alpha ... maybe we could also leave as a dash dev.」—— p082 [02:40]

---

## 3. 从零复现

### 3.1 前置条件

- 已有一个 GKE Autopilot 集群（课里叫 `demo-cluster`），`kubectl` 已指向它。
- 已装好 `kustomize`（或直接用 `kubectl apply -k`）。
- 本地有 Docker，已 `docker login` 到 Docker Hub（用户名课里是 `lmacademy`，你换成自己的）。
- 上一阶段已经存在：`color-db` 目录（含 MongoDB Service、Secret 生成器、初始化脚本 ConfigMap）、`color-api` 源码目录（含 `package.json`、`Dockerfile`）。

复现前建议先确认上下文，避免把 YAML 应用到错误集群。`kubectl config current-context` 会显示当前上下文，`kubectl config get-contexts` 会列出所有上下文。这个动作相当于前端切换接口环境前先确认 `.env` 指向的是 dev 还是 prod；如果上下文不对，后面所有命令都可能作用到错误环境。常见错误是把本地 minikube 或 Docker Desktop 的上下文当成 GKE，结果 `kubectl get pods` 一直看不到预期资源。遇到这种情况，先用 `kubectl config use-context <正确上下文>` 切回去，再继续。

### 3.2 目录结构（本节结束时应长这样）

```
project/
├── color-db/
│   ├── base/
│   │   ├── kustomization.yaml
│   │   ├── mongodb-svc.yaml
│   │   ├── mongodb-statefulset.yaml        # 本节新增
│   │   ├── mongodb-init-configmap.yaml     # 上一阶段已有
│   │   └── mongodb-root-creds-secret.yaml  # 上一阶段已有
│   ├── dev/
│   │   └── kustomization.yaml
│   └── prod/
│       └── kustomization.yaml
└── color-api/
    ├── base/
    │   ├── kustomization.yaml
    │   ├── color-api.yaml                  # 本节新增
    │   └── color-svc.yaml                  # 本节新增
    ├── dev/
    │   └── kustomization.yaml
    ├── prod/
    │   └── kustomization.yaml
    └── src/ ...                            # 你的 Express 源码
```

这个结构的关键是「共享定义放 base，环境差异放 overlay」。前端同学可以把它理解成：`base` 像公共组件库，`dev` 和 `prod` 像不同环境的入口配置。复现时不要把所有 YAML 都平铺到一个目录里，否则后面切换 namespace、改镜像、改副本数会很容易漏改。另一个常见错误是 `dev/kustomization.yaml` 里写错 `../base` 的相对路径，`kubectl apply -k` 会直接报找不到资源。路径问题不要靠猜，执行命令时看报错文件路径即可定位。

### 3.3 步骤一：先看 GKE 有哪些 StorageClass

在写 StatefulSet 之前，先确认集群里可用的存储类。讲师在 p078 [06:52] 就是这么做的：

```bash
kubectl get storageclass
kubectl get storageclass -o custom-columns="NAME:.metadata.name,PROVISIONER:.provisioner"
```

你会看到 `standard-rwo`（standard read-write-once）被标为 default，还有 `premium-rwo` 等。课里最终选了 `standard-rwo`。

![p078 06:52 讲师用 custom-columns 列出 GKE 的 StorageClass 与 provisioner](images/p078_0467s.jpg)

这两条命令的作用不同：第一条看默认输出，能快速看出哪个 StorageClass 带 `(default)` 标记；第二条用 `custom-columns` 只挑 `NAME` 和 `PROVISIONER` 两列，便于确认存储类背后由哪个 provisioner 提供。前端同学可以把 StorageClass 理解成「磁盘套餐」：`standard-rwo` 是标准读写一次，`premium-rwo` 是更高性能套餐。课里选 `standard-rwo` 是为了稳定和成本平衡。常见错误是集群没有默认 StorageClass，或者你在 YAML 里写了不存在的 `storageClassName`，结果 PVC 一直 Pending。排查时先 `kubectl get storageclass`，再 `kubectl describe pvc -n dev <pvc名>` 看事件里有没有「storageclass not found」之类提示。不要在没有确认存储类名称的情况下直接复制别人的 YAML。

### 3.4 步骤二：写 MongoDB StatefulSet

完整文件见第 4 节。要点：

- `serviceName: mongodb-svc` 必须和 Service 名一致（p078 [00:23]）。
- 资源先按讲师最初的 4Gi/1CPU request、8Gi/2CPU limit 写；如果调度失败，按 3.6 减半。
- 环境变量分两组：root 凭据（`MONGO_INITDB_ROOT_USERNAME/PASSWORD`）来自 `mongodb-root-creds`；业务凭据（`DB_NAME/DB_USER/DB_PASSWORD`）来自 `mongodb-colordb-creds`。
- 初始化脚本挂到 `/docker-entrypoint-initdb.d`（p078 [06:27]，注意别拼错）。
- `volumeClaimTemplates` 申请 10Gi，`storageClassName: standard-rwo`。

`serviceName` 的作用是给 StatefulSet 的 Pod 生成稳定 DNS。比如 Pod 名为 `mongodb-ss-0`，Service 名为 `mongodb-svc`，那么 API 侧连接串里就能写 `mongodb-ss-0.mongodb-svc`。在 Node/Express 里，你连接数据库时通常写 `mongodb://localhost:27017/...`；到了 K8s 里，这个 `localhost` 就要换成稳定 DNS。常见错误是 StatefulSet 的 `serviceName` 和 Service 的 `metadata.name` 不一致，Pod 可能仍然能跑，但 DNS 不符合预期，API 连接数据库时会报解析失败或连接超时。另一个常见错误是 `mountPath` 拼错，Mongo 官方镜像不会报「脚本没跑」，而是静默得到一个没有业务用户的库，后面认证才发现问题。

### 3.5 步骤三：Kustomize base + dev/prod

`color-db/base/kustomization.yaml` 把 StatefulSet 加进 resources；`dev/kustomization.yaml` 只引用 `../base` 并设 `namespace: dev`；`prod` 同理改成 `prod`。讲师在 p078 [09:09] 明确说：「this is actually the base... we still need to customize... create our overlays here for dev and for prod」。

这一步的检查重点是 `resources` 列表是否包含了所有需要的 YAML。前端项目里少引一个模块，构建时可能立刻报错；Kustomize 里少写一个资源文件，`kubectl apply -k` 不会报错，但对应资源根本不会被创建。常见错误是只写了 `mongodb-svc.yaml`，忘记把 `mongodb-statefulset.yaml` 加进去，结果 `kubectl get pods -n dev` 什么都没有。排查方式很直接：执行 `kubectl kustomize color-db/dev` 查看最终渲染出的 YAML，确认 StatefulSet、Service、ConfigMap、Secret 都在输出里。如果输出为空或缺少资源，就回到 `kustomization.yaml` 检查路径和文件名。

### 3.6 步骤四：apply 并处理调度失败

```bash
kubectl apply -k color-db/dev
kubectl get pods -n dev -w
```

如果 pod 卡在 `Pending`，`kubectl describe pod -n dev mongodb-ss-0` 会看到 `FailedScheduling` 和「scale up event」。讲师在 p079 [00:00] 说这通常是「no available machines in the zone」。两种解法（课里都用了）：

1. **加 nodeAffinity**：把 `topology.kubernetes.io/zone` 的 `In` 列表放宽到 `europe-west4-a/b/c` 和 `europe-west1-b/c/d`（p079 [02:15]–[04:08]）。
2. **把资源减半**：memory request 2Gi / limit 4Gi，CPU request 0.5 / limit 1（p079 [04:35]）。

![p079 02:15 讲师在 StatefulSet 里加 nodeAffinity，用 topology.kubernetes.io/zone 的 In 操作符放宽可用区](images/p079_0130s.jpg)

`kubectl get pods -w` 的 `-w` 是 watch，会持续刷新状态；前端同学可以把它理解成终端里的「实时热更新预览」，只不过这里刷新的是 Pod 状态。看到 `Pending` 不要立刻反复删除重建，先 `describe` 看 Events。常见原因有三类：资源 request 太大，当前节点放不下；nodeAffinity 限制太死，指定 zone 没有可用节点；GKE Autopilot 正在后台扩容节点，需要等几分钟。课里 p079 [07:16] 提到「pod has triggered a scale up event」，说明 GKE 已经在后台处理。此时正确做法是等待并观察，而不是频繁 apply。若 Events 里明确显示资源不足，就按课里方式减半；若显示 zone 不匹配，就检查 `nodeAffinity` 的 `values` 列表是否包含当前区域可用 zone。

### 3.7 步骤五：验证 MongoDB 认证与持久卷

```bash
kubectl get pvc -n dev
kubectl get pv
kubectl exec -it -n dev mongodb-ss-0 -- mongosh
```

在 mongosh 里：

```js
use colordb
db.auth("colordb-user", "<从 secret 里取的密码>")
```

看到认证成功即说明 Secret 注入和初始化脚本都跑通了（p079 [11:25]）。再去 GCP 控制台 Compute Engine → Disks，能看到一块以 PVC 命名的 balanced persistent disk（p079 [11:50]）。

验证时要分两层：第一层看 PVC 是否 `Bound`，第二层看认证是否成功。PVC Bound 只说明盘申请到了，不代表 Mongo 初始化脚本跑对了；认证成功才说明 Secret 和初始化脚本共同生效。常见错误是 Secret 里的用户名/密码和初始化脚本创建的业务用户不一致，或者 `mongosh` 里没有先 `use colordb`。前端同学可以把这步理解成：数据库连接成功不等于业务表存在，还要确认初始化迁移脚本真的执行过。若 `db.auth` 失败，先检查 Pod 日志，再检查 Secret 键名是否与 StatefulSet 里的 `secretKeyRef.key` 一致。

### 3.8 步骤六：部署 Color API

`color-api/base/color-api.yaml` 是 Deployment，镜像 `lmacademy/color-api:2.0.0`，资源 64Mi/250m request、128Mi/500m limit，端口 80。环境变量里 `DB_USER`、`DB_PASSWORD` 从 `colordb-creds` 取，`DATABASE_URL` 用 `$(DB_USER)`、`$(DB_PASSWORD)` 插值拼成：

```
mongodb://$(DB_USER):$(DB_PASSWORD)@mongodb-ss-0.mongodb-svc:27017/colordb
```

注意主机名是 `mongodb-ss-0.mongodb-svc`——StatefulSet 的 pod 有稳定 DNS，这是它和普通 Deployment 的关键区别（在 Node 里你可以理解为「这个 pod 永远有固定域名，不像普通 pod 重启后 IP 会变」）。

```bash
kubectl apply -k color-api/dev
kubectl get pods -n dev
kubectl logs -n dev <color-api-pod名>
```

日志里出现「connected to database」即成功（p080 [04:08]）。

这一步常见错误是 `DATABASE_URL` 里引用了尚未定义的变量。K8s 的 env 插值要求被引用的变量在前文已经定义，所以 `DB_USER`、`DB_PASSWORD` 要写在 `DATABASE_URL` 之前。另一个常见错误是 Secret 名称写错：MongoDB StatefulSet 用的是 `mongodb-colordb-creds`，Color API 用的是 `colordb-creds`，两者不是同一个 Secret。若 Pod 处于 `CreateContainerConfigError`，优先检查 Secret 是否存在、键名是否匹配。若日志显示连接超时，再检查 MongoDB Pod 是否 Running、Service 名称和 DNS 是否一致。

### 3.9 步骤七：LoadBalancer Service 拿公网 IP

`color-svc.yaml` 是 `type: LoadBalancer`，selector `app: color-api`，port 80 → targetPort 80。apply 后：

```bash
kubectl get svc -n dev -w
```

`EXTERNAL-IP` 先是 `pending`，几分钟后变成真实 IP（p081 [01:17]）。浏览器访问该 IP，再 `POST /color/primary` body `{"value":"green"}`，然后 `GET /color/primary` 能读回 `green`，说明数据落库成功（p081 [02:34]）。

![p081 01:17 讲师 watch Service，EXTERNAL-IP 从 pending 变为真实 IP](images/p081_0079s.jpg)

`EXTERNAL-IP: pending` 不代表失败，只代表云负载均衡器还在创建。GKE 创建外部 LB 需要时间，期间反复删除 Service 反而会拖慢。常见错误是 Service 的 `selector` 和 Deployment 的 Pod 标签不一致，这样 Service 找不到后端 Pod，访问公网 IP 会超时或 502。排查时先 `kubectl get endpoints -n dev color-svc`，如果 Endpoints 为空，就说明 selector 不匹配。另一个常见错误是 `targetPort` 和容器实际监听端口不一致；本课 API 监听 80，所以 `targetPort: 80`，若你本地改过端口，这里也要同步改。

### 3.10 步骤八：给 API 加 Prometheus 指标并打 2.1.0-dev 镜像

在 `color-api` 目录：

```bash
npm install express-prom-bundle@7.0.0 --save-exact
```

在 Express 入口加中间件（完整代码见第 4 节），然后：

```bash
docker build -t lmacademy/color-api:2.1.0-dev .
docker push lmacademy/color-api:2.1.0-dev
```

讲师在 p082 [02:40] 说这是 minor 版本升级，因为「exposing metrics doesn't break anything」。

![p082 02:40 讲师构建并推送 2.1.0-dev 镜像](images/p082_0155s.jpg)

这一步的常见错误是 `npm install` 后没有检查 `package.json` 版本是否被锁定；如果不加 `--save-exact`，可能写成 `^7.0.0`，下次构建时依赖漂移。另一个常见错误是 Docker build 上下文不对，比如在错误目录执行，导致 `COPY` 找不到文件。推送失败则优先检查 `docker login` 和镜像仓库权限。`express-prom-bundle` 中间件要放在其他中间件之前，否则部分请求可能不会被指标统计；这一点和第 5 节解释对应。

---

## 4. 完整代码

### 4.1 `color-db/base/mongodb-statefulset.yaml`

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mongodb-ss
  labels:
    app: mongodb
spec:
  serviceName: mongodb-svc
  replicas: 1
  selector:
    matchLabels:
      app: mongodb
  template:
    metadata:
      labels:
        app: mongodb
    spec:
      affinity:
        nodeAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            nodeSelectorTerms:
              - matchExpressions:
                  - key: topology.kubernetes.io/zone
                    operator: In
                    values:
                      - europe-west4-a
                      - europe-west4-b
                      - europe-west4-c
                      - europe-west1-b
                      - europe-west1-c
                      - europe-west1-d
      containers:
        - name: mongodb
          image: mongo:8.0.0
          ports:
            - containerPort: 27017
          resources:
            requests:
              memory: "2Gi"
              cpu: "500m"
            limits:
              memory: "4Gi"
              cpu: "1"
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
              value: "colordb"
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
            - name: mongodb-init-config
              mountPath: /docker-entrypoint-initdb.d
            - name: mongodb-data
              mountPath: /data/db
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
        storageClassName: standard-rwo
        resources:
          requests:
            storage: 10Gi
```

> 说明：`volumes` 里只放 ConfigMap；`mongodb-data` 由 `volumeClaimTemplates` 自动生成，不要在 `volumes` 里重复声明。课里讲师口述时把两者混着讲，但 YAML 语义上 PVC 模板是独立字段。

### 4.2 `color-db/base/kustomization.yaml`

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - mongodb-svc.yaml
  - mongodb-statefulset.yaml
  - mongodb-init-configmap.yaml
  - mongodb-root-creds-secret.yaml
```

### 4.3 `color-db/dev/kustomization.yaml`

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: dev
resources:
  - ../base
```

### 4.4 `color-db/prod/kustomization.yaml`

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: prod
resources:
  - ../base
```

### 4.5 `color-api/base/color-api.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: color-api
  labels:
    app: color-api
spec:
  replicas: 1
  selector:
    matchLabels:
      app: color-api
  template:
    metadata:
      labels:
        app: color-api
    spec:
      containers:
        - name: color-api
          image: lmacademy/color-api:2.0.0
          ports:
            - containerPort: 80
          resources:
            requests:
              memory: "64Mi"
              cpu: "250m"
            limits:
              memory: "128Mi"
              cpu: "500m"
          env:
            - name: DB_USER
              valueFrom:
                secretKeyRef:
                  name: colordb-creds
                  key: username
            - name: DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: colordb-creds
                  key: password
            - name: DATABASE_URL
              value: "mongodb://$(DB_USER):$(DB_PASSWORD)@mongodb-ss-0.mongodb-svc:27017/colordb"
```

### 4.6 `color-api/base/color-svc.yaml`

```yaml
apiVersion: v1
kind: Service
metadata:
  name: color-svc
spec:
  type: LoadBalancer
  selector:
    app: color-api
  ports:
    - port: 80
      targetPort: 80
```

### 4.7 `color-api/base/kustomization.yaml`

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - color-api.yaml
  - color-svc.yaml
commonLabels:
  app: color-api
  project: project-gke
```

### 4.8 `color-api/dev/kustomization.yaml` 与 `prod`

```yaml
# dev
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: dev
resources:
  - ../base
```

```yaml
# prod
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: prod
resources:
  - ../base
```

### 4.9 Express 入口加 Prometheus 中间件（`color-api/src/index.js` 片段）

```js
const express = require('express');
const promBundle = require('express-prom-bundle');

const app = express();

// 延迟启动逻辑（你原有的代码，课里没展开）
// ...

const metricsMiddleware = promBundle({
  includeMethod: true,
  includeStatusCode: true,
  includePath: true,
  includeUp: true,
});

app.use(metricsMiddleware);

// 其余中间件和路由（你原有的代码）
// app.use(express.json());
// app.post('/color/:key', ...);
// app.get('/color/:key', ...);

const PORT = process.env.PORT || 80;
app.listen(PORT, () => console.log(`listening on ${PORT}`));
```

> 注意：`app.use(metricsMiddleware)` 必须放在其他中间件之前（p082 [02:10]：「we should add this before we add our other middleware」）。

---

## 5. 逐行解释

**StatefulSet 的 `serviceName: mongodb-svc`**
StatefulSet 依赖一个「headless 或普通 Service」来给每个 pod 提供稳定 DNS。`mongodb-ss-0.mongodb-svc` 这个域名就是靠它生成的。在 Node 里你可以理解为「这个 pod 永远有固定域名，不像普通 pod 重启后 IP 会变」——这正是数据库需要 StatefulSet 而不是 Deployment 的原因。复现时如果 API 连接串写成了 `mongodb-svc` 而不是 `mongodb-ss-0.mongodb-svc`，短时间可能也能解析到某个 Pod，但当副本数变化或需要精确定位 StatefulSet Pod 时，行为就不符合预期。排查 DNS 问题时，可以在 API Pod 里执行 `getent hosts mongodb-ss-0.mongodb-svc` 或 `nslookup`，确认域名能解析。

**`requiredDuringSchedulingIgnoredDuringExecution`**
两个阶段：调度时必须满足（required），运行后即使节点标签变了也不驱逐（ignored during execution）。讲师在 p079 [01:46] 明确念了这个字段名。如果你写成 `preferred...`，就是「尽量满足」，调度器找不到也会硬塞，反而可能又卡住。复现时不要为了「看起来更灵活」随便改成 preferred，因为数据库 Pod 一旦被塞到不合适的节点，后续存储挂载和网络延迟都可能变差。常见错误是缩进写错，`nodeAffinity` 被放到错误层级，`kubectl apply` 会直接报 schema 错误；这类错误看 `kubectl apply` 输出即可定位。

**`operator: In` + zone 列表**
`In` 表示「节点的 zone 标签值在这个列表里」。讲师把 europe-west4 的 a/b/c 和 europe-west1 的 b/c/d 都列进去，等于告诉 GKE autoscaler「这几个区随便挑一个建节点都行」（p079 [03:41]）。前端同学可以把它理解成「允许部署到这些可用区，而不是只允许一个」。常见错误是列表里写了你所在 region 不存在的 zone，Pod 会一直 Pending；排查时用 `kubectl get nodes --show-labels` 看节点上实际的 `topology.kubernetes.io/zone` 值，不要凭记忆写。

**资源 request vs limit**
request 是调度依据（节点必须有这么多空闲才放得下），limit 是运行上限（超了会被 throttle 或 OOMKill）。讲师最初 4Gi request 导致「没有机器放得下」，减到 2Gi 后现有节点就能容纳（p079 [06:19]）。在 Node 里对应 `--max-old-space-size` 那种「软上限」概念，但 K8s 的 limit 是硬性的。复现时如果 MongoDB 频繁 OOMKilled，先看 `kubectl describe pod` 里的 `Last State` 和退出码，再考虑提高 limit；不要直接把 request 和 limit 都拉到很大，否则又会回到调度失败。

**`volumeClaimTemplates` 里的 `storageClassName: standard-rwo`**
不写就用集群 default。讲师在 p078 [08:15] 说「just to make things a little bit more stable, I'm gonna specify this specifically」，因为 default 可能随集群配置变化。`ReadWriteOnce` 表示这块盘同时只能被一个节点挂载——单副本数据库够用。常见错误是把 `volumeClaimTemplates` 写到 `volumes` 下面，或者把 PVC 名称和 `volumeMounts.name` 写得不一致。检查方式是 `kubectl get pvc -n dev`，PVC 名称通常是 `<模板名>-<StatefulSet名>-<序号>`，本课就是 `mongodb-data-mongodb-ss-0`。

**`mountPath: /docker-entrypoint-initdb.d`**
Mongo 官方镜像的约定：这个目录下的 `.js`/`.sh` 会在数据目录为空时自动执行。讲师在 p078 [06:52] 特别提醒「make sure you have no typos here, otherwise the script will not be run」——拼错一个字母，初始化脚本就静默不跑，你会得到一个没有业务用户的空库。复现时如果 `db.auth` 失败，先确认挂载路径，再确认 ConfigMap 是否包含脚本文件。前端同学可以把它类比成「启动时执行的 migration 文件」，路径不对就不会执行。

**`DATABASE_URL` 里的 `$(DB_USER)` 插值**
K8s 会先把同一容器里已定义的 env 展开，再赋给 `DATABASE_URL`。所以 `DB_USER`、`DB_PASSWORD` 必须写在 `DATABASE_URL` 之前。主机名 `mongodb-ss-0.mongodb-svc` 是 StatefulSet 的稳定 DNS，端口 27017 是 Mongo 默认端口（p080 [02:34]）。常见错误是变量名拼错，比如 `$DB_USER` 写成 `$DBUSER`，API 会拿到空值或字面量，日志里通常能看到连接串格式错误。复现时不要把真实密码写进 YAML 明文，继续用 Secret 注入。

**`type: LoadBalancer`**
在 GKE 上会触发创建一个 Google Cloud 外部负载均衡器，分配公网 IP。这就是为什么 `EXTERNAL-IP` 先是 `pending`——云厂商建 LB 需要几分钟（p081 [01:17]）。课里没配 TLS/证书，所以是 HTTP 明文（p081 [02:07] 讲师原话「It is not secure」）。复现时如果浏览器打不开，先确认 Service 的 Endpoints 是否非空，再确认 GCP 防火墙或 LB 状态；不要只盯着 Pod 日志。

**`express-prom-bundle` 的四个选项**
`includeMethod/includeStatusCode/includePath` 让指标带上 HTTP 方法、状态码、路径标签；`includeUp: true` 额外暴露一个 `up` 指标，服务活着就返回 1（p082 [01:49]）。这些指标默认在 `/metrics` 端点暴露，Prometheus 抓取时用。常见错误是把中间件放在路由之后，导致部分请求没被统计；按课里顺序放在其他中间件之前即可。

**`npm install ... --save-exact`**
不加 `--save-exact` 会写成 `^7.0.0`，下次 `npm install` 可能装到 7.x 的更高版本。讲师在 p082 [00:53] 特意重跑了一次加 `--save-exact`，锁定精确版本，保证镜像可复现。复现时构建镜像前先看 `package.json` 和 `package-lock.json` 是否一起更新，避免本地能构建、CI 里装到不同版本。

---

## 6. 复现检查清单

按顺序打勾，任何一步不过就别往下走。每条都补了「怎么验证」，不要只看状态名，最好同时看事件和日志：

- [ ] `kubectl get storageclass` 能看到 `standard-rwo` 且被标 default。
  验证方式：看输出里 `NAME` 列是否有 `standard-rwo`，并确认 default 标记；再执行 `kubectl get storageclass -o custom-columns="NAME:.metadata.name,PROVISIONER:.provisioner"` 确认 provisioner 正常。
- [ ] `kubectl apply -k color-db/dev` 无报错。
  验证方式：命令退出码为 0；再执行 `kubectl kustomize color-db/dev` 确认渲染结果包含 StatefulSet、Service、ConfigMap、Secret。
- [ ] `kubectl get pods -n dev` 里 `mongodb-ss-0` 最终 `Running`（中途 `Pending` + `FailedScheduling` 属正常，等 3–5 分钟）。
  验证方式：用 `kubectl get pods -n dev -w` 观察状态变化；若长时间 Pending，执行 `kubectl describe pod -n dev mongodb-ss-0` 看 Events。
- [ ] `kubectl describe pod -n dev mongodb-ss-0` 里能看到 `ProvisioningSucceeded` 或 `Scheduled` 事件。
  验证方式：重点看 Events 末尾，确认没有持续 `FailedScheduling`；如果有 scale up 事件，说明 GKE 正在扩容，继续等。
- [ ] `kubectl get pvc -n dev` 里 `mongodb-data-mongodb-ss-0` 状态 `Bound`。
  验证方式：`STATUS` 必须是 `Bound`；若 Pending，执行 `kubectl describe pvc -n dev mongodb-data-mongodb-ss-0` 看是存储类问题还是容量问题。
- [ ] `kubectl get pv` 能看到对应 PV，`STORAGECLASS` 为 `standard-rwo`。
  验证方式：确认 PV 的 `CLAIM` 指向 dev namespace 下的 PVC，`STATUS` 为 `Bound`。
- [ ] `kubectl exec -it -n dev mongodb-ss-0 -- mongosh` 后 `db.auth(...)` 返回 `{ ok: 1 }`。
  验证方式：先 `use colordb`，再用 Secret 中的业务用户名和密码认证；若失败，检查 Secret 键名、初始化脚本挂载路径和 Pod 日志。
- [ ] `kubectl apply -k color-api/dev` 后 `color-api` pod `Running`。
  验证方式：`kubectl get pods -n dev` 看 READY 是否 1/1；若不是，执行 `kubectl describe pod` 看是 ImagePullBackOff 还是 CreateContainerConfigError。
- [ ] `kubectl logs -n dev <color-api-pod>` 出现数据库连接成功日志。
  验证方式：用 `kubectl logs -n dev <pod名>` 查看启动日志；若连接失败，检查 `DATABASE_URL`、MongoDB Service 名称和 Secret 名称。
- [ ] `kubectl get svc -n dev` 里 `color-svc` 的 `EXTERNAL-IP` 从 `pending` 变为真实 IP。
  验证方式：用 `kubectl get svc -n dev -w` 观察；若长期 pending，检查 GCP 配额和 Service 事件。
- [ ] 浏览器访问该 IP 返回 API 首页；`POST /color/primary` 后 `GET /color/primary` 能读回。
  验证方式：先 GET 确认服务可达，再 POST JSON，再 GET 确认数据落库；若 502，检查 `kubectl get endpoints -n dev color-svc` 是否为空。
- [ ] `npm install express-prom-bundle@7.0.0 --save-exact` 后 `package.json` 里是精确版本（无 `^`）。
  验证方式：打开 `package.json` 看依赖值是否为 `7.0.0`，并确认 lock 文件已更新。
- [ ] `docker build -t <你的用户名>/color-api:2.1.0-dev .` 成功。
  验证方式：构建日志最后无报错；构建上下文应包含 `package.json`、`Dockerfile` 和源码。
- [ ] `docker push <你的用户名>/color-api:2.1.0-dev` 成功。
  验证方式：推送日志显示 layers pushed；若 401/403，重新 `docker login` 并检查仓库权限。
- [ ] 收尾：不用时 `kubectl delete -k color-db/dev` 和 `kubectl delete -k color-api/dev`，避免 GKE 持续计费（p078 [02:26] 讲师反复强调）。
  验证方式：删除后 `kubectl get pods -n dev` 和 `kubectl get svc -n dev` 不再有本节资源；再到 GCP 控制台确认磁盘和负载均衡器已释放。

---

## 7. 课里没讲但你会撞上的

下表把复现时容易遇到的现象、原因和处理方式放在一起。表格内容是对前文事实的展开和通用排查说明，不替代课里原话；遇到具体报错时，仍以你集群的实际输出为准。

| 现象 | 原因 | 怎么办 |
| --- | --- | --- |
| `kubectl get storageclass` 的输出字段名和课里不完全一样 | 课里只演示了 `custom-columns` 的 `NAME` 和 `PROVISIONER` 两列，实际默认输出还有 `RECLAIMPOLICY`、`VOLUMEBINDINGMODE`、`ALLOWVOLUMEEXPANSION`、`AGE` 等列 | 以你集群实际输出为准，不要照抄本文档字段名；需要固定列时继续用 `custom-columns` 明确指定 |
| `kubectl describe pod` 里的事件内容和课里提到的字样不完全一致 | 课里只提到会看到 `FailedScheduling`、`Scheduled`、`scale up event` 等，没有逐字念完整事件 JSON 字段 | 排查时看 Events 的 `Reason`、`Message`、时间顺序和是否持续出现；以实际输出定位资源、zone 或镜像问题 |
| 不知道 `mongodb-root-creds` 和 `mongodb-colordb-creds` 是从哪来的 | 课里假设它们已存在，上一阶段用 Secret 生成器创建；讲师在 p078 [03:50] 提到引用的 Secret 不在 colordb 应用管理范围内 | 从零复现时先创建 Secret，或在 base 里放 `secretGenerator`；创建后用 `kubectl get secret -n dev` 确认名称和键名 |
| Color API 报错说找不到数据库凭据 | `colordb-creds` 与 `mongodb-colordb-creds` 是两个不同的 Secret：StatefulSet 用后者给 Mongo 注入业务用户，Color API 用前者给 API 注入连接凭据 | 要么建两个 Secret，要么统一命名并同步改两处 YAML；检查 `secretKeyRef.name` 和 `key` 是否与 Secret 实际内容一致 |
| GKE 费用比预期高 | 讲师在 p078 [02:26] 提到免费试用额度，但 Autopilot 仍按 Pod 实际 request 计费，MongoDB 的 2Gi/4Gi 跑一天也会消耗额度 | 不用时执行 `kubectl delete -k color-db/dev` 和 `kubectl delete -k color-api/dev`；定期到 GCP 控制台确认磁盘、负载均衡器和节点是否释放 |
| `/metrics` 端点暴露在公网 | 课里只加了 `express-prom-bundle` 中间件，没有讲鉴权；LoadBalancer 又是公网 HTTP | 生产环境要限制来源 IP、加 basic auth，或不要直接把 `/metrics` 暴露在公网；至少不要把敏感指标和业务接口放在同一无保护入口 |
| 删除 Service 后公网 IP 变了 | 课里没讲静态 IP；LoadBalancer Service 删除重建后 GCP 可能分配新 IP | 需要固定 IP 时先创建静态地址，再在 Service 里配置；若只是临时测试，记录 IP 变化即可 |
| 换区域后 MongoDB Pod 一直 Pending | `nodeAffinity` 的 zone 列表是硬编码的，课里写的是 europe-west4 和 europe-west1 的可用区 | 换区域必须改 `values` 列表，先 `kubectl get nodes --show-labels` 看实际 zone；更通用的写法需要结合 region 标签，但课里没展开 |
| prod overlay 看起来和 dev 一样 | 课里 prod 和 dev 的 kustomization 除了 `namespace` 完全一样，prod 也会用 `2.0.0` 镜像和同样资源 | 本节只完成了 namespace 区分，真正生产化要后续再做镜像、副本数、HPA、SSD 等差异化；不要误以为 prod 已经完整生产可用 |
| `mongosh` 认证时不知道密码从哪拿 | 讲师在 p079 [11:25] 说密码从字符串里复制，但没有演示从 Secret 解码 | 用 `kubectl get secret -n dev mongodb-colordb-creds -o jsonpath='{.data.password}'` 取出编码值，再执行 `base64 -d` 解码；不要直接把密码写进 YAML 或提交到仓库 |

---

**参考截图汇总**（本文档共插入 4 张，均来自清单内帧号；如需补充，可从 p078–p082 的终端/编辑器帧中再选，例如 p078 [06:52] 的 StorageClass 列表、p080 [02:04] 的 DATABASE_URL 编辑、p081 [02:34] 的 POST 测试）：

![p078 06:52 StorageClass 列表](images/p078_0467s.jpg)
![p079 02:15 nodeAffinity 编辑](images/p079_0130s.jpg)
![p081 01:17 Service EXTERNAL-IP](images/p081_0079s.jpg)
![p082 02:40 构建 2.1.0-dev 镜像](images/p082_0155s.jpg)