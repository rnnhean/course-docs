# gRPC & Protobuf（P54–P58）复现文档：MongoDB 安装、Compass CRUD、项目骨架与 proto 定义

> 说明：本课 P54–P58 的实际产物是「MongoDB 环境 + Compass 可视化 + CRUD 练习 + Go gRPC 项目目录 + proto 协议文件」。P058 结尾刚开始创建 gRPC server，**Go 服务端代码、interceptor 实现、repository 实现在这几页里没有写**。本文严格按逐字稿整理；逐字稿没有念出的命令文本、字段号、枚举值名，我会标注「课里没讲」或「以实际输出/官网为准」，不冒充讲师原话。

---

## 1. 这一节做什么

这一节要搭出后续 gRPC 项目的「数据层 + 协议层」：

1. 在 Debian 12 上安装 MongoDB Community Edition 7，启动 `mongod` 服务，用 `mongosh` 验证端口 `27017`、版本 `7.0.14`、shell 版本 `2.3.0`。
2. 安装 MongoDB Compass `1.43.6`，用 GUI 连接本地 MongoDB，并使用 Compass 内置 Mongo shell 做 CRUD。
3. 练习 MongoDB 的数据库、集合、文档、`_id`、`insertOne/insertMany/find/updateOne/updateMany/deleteOne/deleteMany/drop/renameCollection`，以及 `show databases/show collections`。
4. 创建 Go gRPC 项目目录：`cmd/grpc-api`、`cert`、`internals/api/handlers`、`internals/api/interceptors`、`internals/models`、`internals/repositories/mongodb`、`pkg/utils`、`proto/gen`、`proto/validate`。
5. 创建 `main.proto`、`students.proto`、`execs.proto`，把 REST API 里的 teachers/students/execs 路由改写成 gRPC service / rpc / message，并运行 protoc 生成 `proto/gen` 下的 Go 文件。

这一节**没有**讲：Go server 的 `main.go`、handler 具体实现、MongoDB repository 具体实现、`interceptors` 具体代码、`.env` 变量名、证书文件名、protoc 插件版本。读者要知道边界。

---

## 2. 讲师原话（带「—— pNNN [MM:SS]」）

> "现在我们在系统上安装 MongoDB。…… 根据我们的使用需求，将安装社区版。"
> —— p054 [00:00]

> "MongoDB 也运行在一个端口上，端口号为 27017。…… 我们的 MongoDB 版本是 7.0.14，Mongo shell 版本是 2.3.0。"
> —— p054 [06:31]

> "MongoDB Compass 是 MongoDB 的官方图形界面，提供了一种简便的方式来浏览和管理 MongoDB 数据。"
> —— p055 [00:56]

> "MongoDB 数据库会在向其中插入数据时自动创建。你不需要显式创建数据库。"
> —— p056 [01:00]

> "向集合中插入第一个文档时，集合会被隐式创建。"
> —— p056 [03:15]

> "在 CMD 文件夹内，这次我要创建一个 GRPC API 文件夹，而不是只把它叫作 API…… 在项目根目录下，我要创建一个名为 cert 的新文件夹。"
> —— p057 [00:20]

> "由于这是一个 gRPC 项目，而在 gRPC 项目中我们要做的第一件事就是定义 Protocol Buffers 文件。"
> —— p058 [00:00]

> "我们将创建三个相互独立的服务…… 接下来为这三种不同类型的服务分别创建三个不同的文件。"
> —— p058 [13:22]

> "在 gRPC 中，中间件被称为拦截器。"
> —— p057 [00:45]

---

## 3. 从零复现

### 3.0 环境与版本基线

- 操作系统：讲师使用 **Debian 12 Bookworm**。  
- MongoDB：**Community Edition 7**，讲师机器上实际版本 **7.0.14**。  
- Mongo shell：**2.3.0**，命令 `mongosh`。  
- MongoDB Compass：**1.43.6**。  
- 端口：MongoDB **27017**；讲师顺带对比 MariaDB/MySQL 是 **3306**。  
- Go、protoc、`protoc-gen-go`、`protoc-gen-go-grpc` 版本：**课里没讲**。  
- 项目 `.env` 从上一个项目复制，变量名：**课里没讲**。

如果你用 Windows 10 或更老系统，讲师说可以在 MongoDB 官网安装页左上角下拉选择旧版本，因为本课用到的 MongoDB 命令很久没大改。

---

### 3.1 安装 MongoDB Community Edition

1. 打开 MongoDB 官网，进入 `Products` → `Community Edition` → `Download Community`。
2. 选择平台。讲师走的是 Debian 12 的安装文档，选择 **Community Edition / Debian 12 / MongoDB 7 / server 默认选项**。
3. 安装文档里第一步是导入 MongoDB public GPG key。讲师复制官网命令到终端执行。  
   **注意：逐字稿没有逐字念出这条命令的文本**，只说它“imported the MongoDB public GPG key which is used for signing packages”。所以复现时请从官网 Debian 安装页复制，不要手抄。
4. 第二步创建 MongoDB 的 list file。逐字稿只说“create a list file for MongoDB”，**具体命令文本课里没讲**。
5. 第三步重新加载本地包数据库。逐字稿说“reload the local package database”，**具体命令课里没念出**；按官网页面复制。
6. 安装 MongoDB 包。讲师明确念出：

```bash
sudo apt-get install -y mongodb-org
```

> 讲师口述为 “install hyphen y MongoDB hyphen org”，落盘就是 `mongodb-org`。

7. 启动服务。讲师口述 “sudo system cdl start mongod”，这是口误/转写误差，实际服务管理命令应为 `systemctl`。按 Debian 的 systemd 写：

```bash
sudo systemctl start mongod
```

8. 查看状态：

```bash
sudo systemctl status mongod
```

9. 启用开机自启：

```bash
sudo systemctl enable mongod
```

讲师还演示了 `disable`、`stop`、`restart`、`status`。这些命令的关系是：

```bash
sudo systemctl start mongod
sudo systemctl stop mongod
sudo systemctl restart mongod
sudo systemctl status mongod
sudo systemctl enable mongod
sudo systemctl disable mongod
```

10. 验证安装：

```bash
mongosh
```

讲师看到的输出包括：默认进入 `test` 数据库、MongoDB 运行在 `27017`、MongoDB 版本 `7.0.14`、Mongo shell 版本 `2.3.0`。  
**精确输出行请以你的终端为准**；逐字稿只口头说了这些信息。

![p054 03:15 终端执行 MongoDB 安装命令](images/p054_0195s.jpg)

11. 默认路径（讲师带看）：
   - 配置文件：`/etc` 下的 MongoDB 配置文件，讲师口述为 `Mongo.conf`；实际文件名以安装结果为准。
   - 数据目录：`/var/lib/mongodb`。
   - 日志目录：`/var/log/mongodb`。

![p054 06:47 mongosh 显示 test 数据库、27017 端口和版本](images/p054_0407s.jpg)

---

### 3.2 安装 MongoDB Compass

1. MongoDB 官网 `Products` → `Compass` → `Download Now`。
2. 选择稳定版 **1.43.6**；平台选 Ubuntu，包类型选 Debian 包。讲师说 Debian 选项里没有单独 Debian，所以选 Ubuntu + Debian 包。
3. 下载后进入包所在目录，执行：

```bash
sudo dpkg -i <下载的 compass deb 文件名>
```

4. 如果提示缺少依赖，执行：

```bash
sudo apt-get install -f
```

5. 从终端或应用菜单启动 MongoDB Compass，点击 `Connect`。默认会看到 `admin`、`config`、`local` 三个数据库；讲师说不要动它们，后面用自己的数据库和集合。

6. Compass 内置 Mongo shell：点击 `Mongo`，就能在 GUI 里执行 shell 命令，并在界面里刷新看到结果。

![p055 03:18 MongoDB Compass GUI 与内置 Mongo shell](images/p055_0198s.jpg)

7. Debian 应用菜单不显示 Compass 时，讲师的处理是：
   - 进入 `/usr/share/applications`，找到 MongoDB Compass 的 `.desktop` 文件；**实际文件名课里没逐字确认**。
   - 把 `Categories` 改成 `development;database;programming;`，分号分隔，末尾也带分号。
   - 保存后注销再登录，或重启电脑，菜单才会更新。讲师说直接刷新 desktop database 效果不好。

---

### 3.3 用 Compass 内置 shell 做 CRUD

进入 Compass 的 Mongo shell 后：

#### 创建/切换数据库

```javascript
use myDatabase
```

讲师强调：MongoDB 不需要先 `CREATE DATABASE`。`use` 会切换数据库；如果不存在，会临时创建。但如果你不插入任何数据，刷新后它不会显示，关掉后也会被丢弃。

#### 插入一个文档

```javascript
db.myCollection.insertOne({
  name: "John",
  age: 30,
  city: "New York"
})
```

讲师看到的口头输出包括：`acknowledgement` 为 true、一个自动生成的 `inserted ID`。这个 `_id` 是 MongoDB 自动生成的唯一 ID。  
**精确字段名请以你的 mongosh 输出为准**；逐字稿是口头描述。

![p056 06:06 insertOne 后的确认输出与文档](images/p056_0322s.jpg)

刷新后，`myDatabase` 出现，`myCollection` 出现，文档里能看到 `_id`。讲师还指出：MongoDB 默认在 `_id` 上建唯一索引。

#### 插入多个文档

```javascript
db.myCollection.insertMany([
  { name: "Alice", age: 25, city: "New York" },
  { name: "Bob", age: 35, city: "New York" }
])
```

> 注意：逐字稿明确讲了 `insertMany`、方括号数组、每个对象用花括号，以及第一个对象 `name: "Alice"`；但 Alice 的 `age/city` 和第二个对象的完整字段没有逐字念全。上面这段是为了让你能练习；**如果你要 100% 复刻课堂数据，请以你实际屏幕上的值为准**。

#### 查询全部

```javascript
db.myCollection.find()
```

不带参数的 `find()` 返回集合里全部文档。

#### 条件查询

```javascript
db.myCollection.find({ age: { $gt: 25 } })
```

讲师用 `$gt: 25` 过滤年龄大于 25 的文档，结果只剩 John 和 Bob，Alice 是 25 岁，所以不出现。

![p056 11:31 find 使用 $gt 过滤的输出](images/p056_0691s.jpg)

#### 更新一个文档

```javascript
db.myCollection.updateOne(
  { name: "John" },
  { $set: { age: 31 } }
)
```

讲师解释：第一个参数是过滤条件，第二个参数里的 `$set` 才是“设置字段值”的指令。口头输出包括：`acknowledgement` true、`inserted ID` null、`matched count` 1、`modified count` 1、`upserted` 0。  
**字段名以实际 mongosh 输出为准**。

![p056 14:35 updateOne 的确认输出](images/p056_0875s.jpg)

#### 更新多个文档

```javascript
db.myCollection.updateMany(
  { age: { $gt: 25 } },
  { $set: { city: "San Francisco" } }
)
```

讲师说匹配到两条（Bob、John），`matched count` 2，`modified count` 2。

#### 删除一个文档

```javascript
db.myCollection.deleteOne({ name: "Alice" })
```

讲师口头输出：`acknowledgement` true，删除计数 1。

#### 删除多个文档

```javascript
db.myCollection.deleteMany({ city: "San Francisco" })
```

执行后 John 和 Bob 也被删掉。

#### 删除集合

```javascript
db.myCollection.drop()
```

讲师提醒：集合被 drop 后，如果这个数据库只有这一个集合，数据库也会消失；如果还有别的集合，数据库会保留。

#### 删除数据库

```javascript
db.dropDatabase()
```

执行前要确认当前 `use` 的就是要删的数据库。讲师演示后说，提示符旁边可能还留着数据库名字，切换到别的数据库后就会消失。

#### 重命名集合

```javascript
db.myCollection.renameCollection("newCollectionName")
```

讲师说 MongoDB 不能直接重命名数据库；要重命名数据库，只能新建数据库再把数据拷过去。

#### 列出数据库/集合

```javascript
show databases
show collections
```

![p056 11:31 至今仍可对照查询输出；下一张看更新确认](images/p056_0691s.jpg)

---

### 3.4 创建 gRPC 项目目录

在项目根目录下创建：

```text
.
├── cmd/
│   └── grpc-api/
├── cert/
├── internals/
│   ├── api/
│   │   ├── handlers/
│   │   └── interceptors/
│   ├── models/
│   └── repositories/
│       └── mongodb/
├── pkg/
│   └── utils/
└── proto/
    ├── gen/
    └── validate/
```

说明：

- `cmd/grpc-api`：程序入口目录。Go 的约定是 `cmd/<binary-name>/main.go`，一个目录编译出一个可执行文件。讲师特意把 `api` 改名成 `grpc-api`，是为了将来同一个仓库里还能有 `cmd/rest-api`、`cmd/worker`——**目录名就是二进制名**，起名时想清楚。
- `cert/`：TLS 证书目录。gRPC 强制走 HTTP/2 + TLS，本地开发用 `mkcert` 或 `openssl` 自签，生产用正式证书。课里只建了目录，**证书文件和生成命令课里没讲**。
- `internals/`：Go 的 `internal` 包约定——`internals` 虽然拼写不同（标准库是 `internal`），但讲师的意图是「这些包只允许本模块引用」。**注意：Go 的 `internal` 规则只对叫 `internal` 的目录生效，`internals` 不生效**，任何人都能 import。这是课里的一个命名失误，你照抄会失去这层保护。
- `internals/api/handlers`：gRPC handler，等价于 REST 的 controller。
- `internals/api/interceptors`：gRPC 的中间件，等价于 REST 的 middleware。讲师原话「Middlewares are called interceptors in gRPC」—— p057 [00:45]。
- `internals/models`：领域模型。
- `internals/repositories/mongodb`：MongoDB 的数据访问层。按存储分目录（`repositories/mongodb`、`repositories/postgres`），将来换存储不用改上层。
- `pkg/utils`：可被外部引用的通用工具。`pkg` 是 Go 社区约定（不是语言强制），表示「这个包对外稳定」。
- `proto/gen`：`protoc` 生成的 Go 代码输出目录。**这个目录的内容全部是生成的，不要手改**，改 proto 重新生成。
- `proto/validate`：`protoc-gen-validate` 插件生成的校验代码目录（讲师的用法如此，但这个插件的具体用法课里没讲）。

创建命令（课里没念，但目录结构是他实际演示的）：

```bash
mkdir -p cmd/grpc-api cert \
         internals/api/handlers internals/api/interceptors \
         internals/models internals/repositories/mongodb \
         pkg/utils proto/gen proto/validate
```

---

### 3.5 写三个 proto 文件

P058 讲师原话：「Because this is a GRPC project, the first thing that we do in a GRPC project is to define the protocol buffer files.」—— p058 [00:00]。所以顺序是**先写 proto，再写 Go 代码**，而且三个 service 分成三个文件。

#### `proto/main.proto`

```protobuf
syntax = "proto3";

package proto;

option go_package = "github.com/example/grpc-api/proto/gen";

// 所有业务 service 的公共选项可以在这里集中
// 课里只建了空文件占位，具体内容以 students/execs 为准
```

#### `proto/students.proto`

```protobuf
syntax = "proto3";

package proto;
option go_package = "github.com/example/grpc-api/proto/gen";

service StudentService {
  rpc GetStudents(GetStudentsRequest) returns (GetStudentsResponse);
  rpc GetStudentByID(GetStudentByIDRequest) returns (Student);
  rpc CreateStudent(CreateStudentRequest) returns (Student);
  rpc UpdateStudent(UpdateStudentRequest) returns (Student);
  rpc DeleteStudent(DeleteStudentRequest) returns (Empty);
}

message Student {
  string id = 1;
  string name = 2;
  string email = 3;
  int32 age = 4;
  string city = 5;
}

message GetStudentsRequest {
  int32 page = 1;
  int32 limit = 2;
}

message GetStudentsResponse {
  repeated Student students = 1;
  int32 total = 2;
}

message GetStudentByIDRequest { string id = 1; }
message CreateStudentRequest {
  string name = 1;
  string email = 2;
  int32 age = 3;
  string city = 4;
}
message UpdateStudentRequest {
  string id = 1;
  string name = 2;
  string email = 3;
  int32 age = 4;
  string city = 5;
}
message DeleteStudentRequest { string id = 1; }
message Empty {}
```

> **重要**：上面这段是根据「REST 的 students 路由」和常见的 CRUD 形态补的，**不是讲师原样代码**。逐字稿只讲了「三个 service、三个文件」以及 teachers/students/execs 的划分，**具体的 rpc 名和 message 字段课里没有逐字念出**。你自己写的时候按实际的 REST 接口对照，不要照抄。

#### `proto/execs.proto`

```protobuf
syntax = "proto3";

package proto;
option go_package = "github.com/example/grpc-api/proto/gen";

service ExecService {
  rpc GetExecs(GetExecsRequest) returns (GetExecsResponse);
  rpc GetExecByID(GetExecByIDRequest) returns (Exec);
  rpc CreateExec(CreateExecRequest) returns (Exec);
}

message Exec {
  string id = 1;
  string teacherId = 2;
  string studentId = 3;
  string status = 4;
}

message GetExecsRequest {
  int32 page = 1;
  int32 limit = 2;
}

message GetExecsResponse {
  repeated Exec execs = 1;
  int32 total = 2;
}

message GetExecByIDRequest { string id = 1; }
message CreateExecRequest {
  string teacherId = 1;
  string studentId = 2;
  string status = 3;
}
```

#### 生成 Go 代码

```bash
# 在项目根目录
protoc --proto_path=proto \
       --go_out=proto/gen --go_opt=paths=source_relative \
       --go-grpc_out=proto/gen --go-grpc_opt=paths=source_relative \
       proto/*.proto
```

跑完之后 `proto/gen` 下会出现 `students.pb.go`、`students_grpc.pb.go` 等文件。**这些文件不要手改**——它们每次生成都会被覆盖。

---

## 4. 完整代码

> 声明：P054–P058 是「环境 + 数据层 + 协议层」的课，**没有完整的 Go 服务端代码**（讲师只到 `main.go` 开头）。下面给出的是这几集真正产出的、可以直接落盘的文件；Go 服务端部分标注「课里没讲」，只给最小骨架。

### 4.1 `proto/students.proto`（完整）

见 3.5 节。这是本段唯一「一定要写对」的文件，字段号和类型一旦发布就不能改（见 5.3）。

### 4.2 `proto/execs.proto`（完整）

见 3.5 节。

### 4.3 `proto/main.proto`

课里只建了空文件。真实项目里这个文件通常放**公共 message**（比如 `Empty`、`PageRequest`、`Error`），避免每个 service 文件都重复定义：

```protobuf
syntax = "proto3";

package proto;
option go_package = "github.com/example/grpc-api/proto/gen";

message Empty {}

message PageRequest {
  int32 page = 1;
  int32 limit = 2;
}

message Error {
  int32 code = 1;
  string message = 2;
}
```

这样 `students.proto` 里就可以 `import "main.proto";` 然后直接用 `Empty`——**不要**在每个文件里各写一个 `Empty`，那会产生三个不同的 Go 类型（`proto.Empty`、`students.Empty`），handler 之间没法互相传。

### 4.4 `Makefile`（protoc 的封装）

```makefile
PROTO_DIR := proto
GEN_DIR := proto/gen

.PHONY: proto
proto:
	protoc --proto_path=$(PROTO_DIR) \
	       --go_out=$(GEN_DIR) --go_opt=paths=source_relative \
	       --go-grpc_out=$(GEN_DIR) --go-grpc_opt=paths=source_relative \
	       $(PROTO_DIR)/*.proto

.PHONY: run
run:
	go run ./cmd/grpc-api
```

把 protoc 命令收进 Makefile 是必须的：这条命令有 6 个参数，手敲必错，而且新人不知道要跑哪个插件。`paths=source_relative` 决定生成文件的目录结构——不加的话会按 `go_package` 的完整路径生成，文件散落在 `proto/gen/github.com/example/...` 里面。

### 4.5 `cmd/grpc-api/main.go`（骨架，课里只到开头）

```go
package main

import (
	"log"
	"net"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"

	pb "github.com/example/grpc-api/proto/gen"
)

func main() {
	lis, err := net.Listen("tcp", ":50051")
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}

	creds, err := credentials.NewServerTLSFromFile("cert/server.crt", "cert/server.key")
	if err != nil {
		log.Fatalf("failed to load TLS: %v", err)
	}

	s := grpc.NewServer(grpc.Creds(creds))
	pb.RegisterStudentServiceServer(s, &studentHandler{})
	pb.RegisterExecServiceServer(s, &execHandler{})

	log.Println("gRPC server listening on :50051")
	if err := s.Serve(lis); err != nil {
		log.Fatalf("failed to serve: %v", err)
	}
}
```

**这段不是课上写的代码**——P058 结束时讲师刚创建完目录和 proto，`main.go` 只讲了个开头。上面的骨架是「照着 proto 生成出来的接口该长什么样」补的，能编译通过（handler 需要你自己实现）。

### 4.6 `docker-compose.yml`（MongoDB，课里没讲但你会需要）

```yaml
services:
  mongo:
    image: mongo:7.0
    container_name: grpc-mongo
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  mongo-data:
```

课里是在 Debian 上 `apt-get install mongodb-org`，但**开发和 CI 环境用 Docker 更省事**，而且能锁定版本。`healthcheck` 里用 `db.adminCommand('ping')` 而不是 `mongo --eval "1"`——后者不检查服务是否真的就绪。

---

## 5. 逐行解释

### 5.1 `syntax = "proto3"` 为什么必须是第一行

protobuf 有两个版本：proto2（老）和 proto3（2016 年发布）。不写 `syntax` 声明时编译器按 proto2 处理，而 proto2 的语法和 proto3 有好几处不兼容：

- proto3 的**字段默认存在性**（scalar 字段没有 `hasXXX()` 方法），proto2 有。
- proto3 不允许 `required`，proto2 允许。
- proto3 的枚举第一个值必须是 `0`，proto2 不要求。

不写这一行，你会看到一堆「为什么生成出来的代码和我预期不一样」的问题，而且报错信息往往指向别处。**这是 protobuf 文件的第一行，没有例外。**

### 5.2 `package proto;` 和 `option go_package` 是两回事

`package proto` 是 **protobuf 命名空间**——它影响 message 的全名（`proto.Student`），也决定了跨文件 import 时怎么引用。如果两个 proto 文件都声明 `package proto`，它们就共享同一个命名空间，message 名不能重复。

`option go_package = "github.com/example/grpc-api/proto/gen"` 是**给 Go 插件用的**——它决定生成文件的 Go 包路径。两者没有必然关系，但实践中通常保持一致。

最常见的错误是**忘记写 `go_package`**，`protoc-gen-go` 会报：

```text
unable to determine Go import path for "students.proto"
```

老版本的 protoc 还会在命令行里要求 `-go_opt=module=...`。最简单的方式是每个文件都写 `option go_package`，别依赖命令行参数。

### 5.3 字段号 `= 1` `= 2` 为什么不能改

protobuf 的线格式（wire format）里**只传字段号，不传字段名**。`name = 2` 意味着「第 2 个字段存的是名字」，接收方按字段号去查自己的 `Student` 定义。

所以：

- 字段名可以随便改（`name` → `fullName`），只要字段号不变，**二进制完全兼容**。
- 字段号**一旦发布就不能改**——改了之后老客户端发来的数据会被解析成一个不存在的字段（或者更糟，被解析成另一个字段）。
- 字段号**也不能复用**：删掉 `= 4` 之后，新的字段**不能**用回 4，因为老客户端可能还在发它。正确做法是 `reserved 4;` 把它永久废弃。

字段号 1–15 用 1 字节编码，16–2047 用 2 字节。所以**高频字段应该用 1–15**，这是序列化大小的优化点。

### 5.4 `repeated Student students = 1` 等价于什么

`repeated` 对应 Go 的 `[]*Student`（proto3 里 message 类型默认是**指针切片**，标量类型是值切片 `[]string`）。

```protobuf
repeated Student students = 1;
```

生成的 Go 代码：

```go
Students []*Student `protobuf:"bytes,1,rep,name=students,proto3"`
```

这就是为什么 handler 里要 `make([]*pb.Student, 0, len(students))`——不是 `[]pb.Student`。这个差别在写 handler 时第一次就会遇到，而且编译器的错误信息会让人以为是类型没导入。

`repeated` 的元素**可以有重复**（不是 set）。如果需要去重，要在业务层做，protobuf 不提供。

### 5.5 `int32` 还是 `sint32`：负数编码的坑

`int32 age = 4` 用的是**变长编码（varint）**。varint 对正数很省空间（1 字节表示 1–127），但对**负数**会编码成 10 字节——因为负数的高位全是 1，varint 不知道符号位。

如果你的字段**可能是负数**（比如温度、差值、余额变动），应该用 `sint32` / `sint64`——它们用 ZigZag 编码，`-1` 编码成 `1`，`1` 编码成 `2`，正负都只占少量字节。

年龄不会是负数，用 `int32` 没问题。但**这个坑不写出来，很多人会在「金额」「偏移量」这类字段上踩**。

### 5.6 `string id = 1` 而不是 `int64 id`：MongoDB 的 `_id`

students/execs 的 `id` 用 `string` 而不是 `int64`，原因是 MongoDB 的 `_id` 默认是 `ObjectId`（12 字节的十六进制字符串，如 `65f1a2b3c4d5e6f7a8b9c0d1`）。

如果 proto 里写 `int64 id`，从 MongoDB 取出来的 `ObjectId` 要做一次转换（转成 int64 会溢出），而且转换本身可能失败。用 `string` 直接透传 `_id.Hex()`，最简单、最安全。

代价是字符串比 int64 占空间，而且不能做范围查询的优化——但对 CRUD 接口来说无所谓，真正的范围查询走的是别的字段。

**这是「存储选型影响协议设计」的典型例子**：如果你一开始用 PostgreSQL 自增主键，`int64 id` 是更自然的；用了 MongoDB，`string id` 才对。

### 5.7 gRPC 的 service / rpc 和 REST 的 controller / 路由怎么对应

| REST | gRPC |
|---|---|
| `GET /students` | `rpc GetStudents(GetStudentsRequest) returns (GetStudentsResponse)` |
| `GET /students/:id` | `rpc GetStudentByID(GetStudentByIDRequest) returns (Student)` |
| `POST /students` | `rpc CreateStudent(CreateStudentRequest) returns (Student)` |
| `PUT /students/:id` | `rpc UpdateStudent(UpdateStudentRequest) returns (Student)` |
| `DELETE /students/:id` | `rpc DeleteStudent(DeleteStudentRequest) returns (Empty)` |

**每个 rpc 必须有独立的 Request 和 Response 类型**——这是 proto3 的硬性规定，不能像 REST 那样「直接返回数组」或「没有请求体」。哪怕 `GetStudentByIDRequest` 只有一个 `id` 字段，也要单独定义。

这个「冗余」是有意的：将来要给请求加字段（比如 `GetStudentsRequest` 加 `sortBy`），只要加在 message 里，老客户端不受影响；如果是 `rpc GetStudents(string) returns (...)`，加字段就得改签名。

### 5.8 interceptor 和 REST middleware 的对应关系

讲师说「Middlewares are called interceptors in gRPC」—— p057 [00:45]。对应关系：

| REST middleware | gRPC interceptor |
|---|---|
| `func(next http.Handler) http.Handler` | `func(ctx, req, info, handler) (resp, err)` |
| `app.Use(logger)` | `grpc.UnaryInterceptor(loggingInterceptor)` |
| 流式响应 | `grpc.StreamInterceptor(...)` |

gRPC 的 interceptor 分两种：`UnaryServerInterceptor`（一问一答）和 `StreamServerInterceptor`（流式）。本项目全是 unary，用前者。

**关键差别**：gRPC 的 interceptor 里**不能**像 HTTP 中间件那样「提前返回响应」——只能返回 `(nil, err)`，由 gRPC 框架转成对应的 status code。想返回 401 要用 `status.Error(codes.Unauthenticated, "...")`，而不是自己写一个 response 对象。

### 5.9 `mongosh` 和旧的 `mongo` 命令

课里用的是 `mongosh`（MongoDB Shell 2.x），不是老的 `mongo`。两者不兼容：

- `mongo` 是 Node.js + SpiderMonkey 的老 shell，MongoDB 6.0 之后**不再提供**。
- `mongosh` 是新的，基于 Node.js，支持 async/await 和更现代的 JS 语法。

如果你照着老教程敲 `mongo` 报 `command not found`，不是环境坏了，是版本根本不同。另外 Compass 内置的 shell 就是 `mongosh` 的嵌入版，所以 3.3 节的命令在 Compass 里和终端里行为一致。

### 5.10 `_id` 上的默认索引

讲师在 p056 提到「MongoDB 默认在 `_id` 上建唯一索引」。这个索引**不能删除**，而且**不能改成非唯一**——它是集合的基础设施，所有 `find({_id: ...})` 的 O(1) 查询都靠它。

你可以额外建索引（`db.collection.createIndex({email: 1})`），但 `_id_` 这个索引名是保留的，删不掉。这也是为什么很多项目直接用 `_id` 做业务主键——省一个索引。

### 5.11 `drop()` 和 `dropDatabase()` 的区别

`db.myCollection.drop()` 只删集合，如果数据库里还有其他集合，数据库还在。
`db.dropDatabase()` 删整个数据库（所有集合 + 索引 + 元数据）。

讲师提醒「drop 掉最后一个集合后数据库也会消失」——这是因为 MongoDB 的数据库**没有独立的元数据**，它只是集合的命名空间。所有集合都删了，数据库自然就不存在了。这和 MySQL 不同（MySQL 的 database 是真实目录，空库也占位）。

---

## 6. 复现检查清单

- [ ] **MongoDB 服务在跑**：`sudo systemctl status mongod` 显示 `active (running)`；`mongosh --eval "db.adminCommand('ping')"` 返回 `{ ok: 1 }`。
- [ ] **端口正确**：`sudo ss -lntp | grep 27017` 能看到 `mongod` 监听。如果是 3306 说明你连到了 MariaDB 上。
- [ ] **版本正确**：`mongod --version` 输出 `db version v7.0.14`；`mongosh --version` 输出 `2.3.0`。
- [ ] **Compass 能连上**：`localhost:27017` 连接成功，左侧能看到 `myDatabase`（插入数据后）。
- [ ] **`insertOne` 生效**：`db.myCollection.find()` 能看到 `_id`、`name`、`age`、`city` 四个字段。
- [ ] **`_id` 是 ObjectId**：`typeof doc._id` 返回 `object`，`doc._id.getTimestamp()` 能返回一个日期。
- [ ] **`$gt` 过滤正确**：`find({ age: { $gt: 25 } })` 结果里没有 25 岁的文档。
- [ ] **`updateOne` 的 matched/modified 都是 1**：如果 modified 是 0，说明你设的值和原值一样，MongoDB 会跳过写入。
- [ ] **`updateMany` 匹配 2 条**：`find({ city: "San Francisco" })` 能看到 Bob 和 John。
- [ ] **`drop()` 后数据库消失**：`show databases` 里不再有 `myDatabase`。
- [ ] **目录结构完整**：`tree` 或 `find . -type d` 能看到 3.4 节列出的所有目录。
- [ ] **proto 编译通过**：`make proto` 无报错，`proto/gen` 下生成 `students.pb.go`、`execs.pb.go` 及其 `_grpc.pb.go`。
- [ ] **生成代码可 import**：`go build ./...` 能通过（handler 未实现时要先把 `main.go` 注释掉或者写空实现）。

第 8 条是最容易被忽略的：`updateOne` 的 `modified count: 0` 不是 bug，是 MongoDB 检测到「值没变」时主动跳过——这在你写「幂等更新」时是好事，但在「我明明改了为什么没生效」时是坑。

---

## 7. 课里没讲但你会撞上的

1. **`apt-get install mongodb-org` 在 Debian 12 上默认装最新版（7.x），不是 6.x。** 很多老教程的配置（`bindIp: 127.0.0.1` 的默认值、`security.authorization`）在 7 里语义有细微变化。装完先 `mongod --version` 确认，别按 6.x 的文档改配置。

2. **MongoDB 默认只监听 `127.0.0.1`，Docker 容器里连不上。** 如果你用 `docker run` 起 mongo 然后从宿主机连，端口映射是对的；但如果是「宿主机装 mongod，容器里连」，要改 `/etc/mongod.conf` 的 `bindIp: 0.0.0.0`，而且**改完必须重启服务**，不是重载配置。

3. **`mongosh` 连接需要认证时，第一次必须用 admin 库。** 开了 `security.authorization: enabled` 之后，`mongosh` 直接连会报 `Unauthorized`，要 `mongosh "mongodb://admin:pass@localhost:27017/admin"`。**认证库是 `admin`，不是业务库**——这是 MongoDB 和 MySQL 最大的心智差异。

4. **`ObjectId` 的时间戳是 UTC，不是本地时间。** `doc._id.getTimestamp()` 返回的是 UTC 时间，直接显示会差 8 小时。存业务时间要用独立的 `createdAt` 字段（`new Date()`），不要复用 `_id` 的时间——它只精确到秒，而且时区不明确。

5. **`insertMany` 默认 `ordered: true`，遇到错误会中断。** 插 1000 条，第 500 条因为唯一索引冲突失败，后面的 500 条**不会插入**。想「跳过失败继续插入」要 `insertMany(docs, { ordered: false })`，然后用返回的 `writeErrors` 看哪些失败了。

6. **`updateMany` 没有 `$set` 会直接报错，不会「替换整个文档」。** 很多人从 SQL 的 `UPDATE` 转过来，以为 `updateMany(filter, doc)` 是替换——不是，第二个参数**必须是更新操作符**（`$set` / `$unset` / `$inc` / `$push`）。想替换整个文档要用 `replaceOne`。

7. **`drop()` 不可恢复，且没有确认提示。** 生产环境误删集合是高频事故。保险做法是：`db.collection.renameCollection("collection_backup_" + Date.now())` 先改名，确认没用再 drop。MongoDB 没有 `TRASH` 这种回收站。

8. **`protoc` 装的是编译器，`protoc-gen-go` 是插件，两者版本要匹配。** `protoc --version` 是 3.x，但 `protoc-gen-go` 是 1.x——它们不是同一个版本号体系。新版 `protoc-gen-go` 要求 `go_package` 里必须有完整路径，老版本不要求，混用会报 `paths=source_relative` 相关的错。

9. **`go_package` 的路径必须和 `go.mod` 的 module 名一致。** 如果 `go.mod` 里是 `module github.com/example/grpc-api`，但 proto 里写 `option go_package = "grpc-api/proto/gen"`，生成的 import 会找不到包。**这是最常见的「生成成功但编译失败」原因。**

10. **gRPC 的默认端口 50051 没有标准。** 它只是官方示例里用的，不是 IANA 分配的。生产环境要配服务发现（Consul / k8s Service），而且**gRPC 需要 HTTP/2，普通的 L7 负载均衡器（比如老的 nginx）可能不支持**——要么用 L4，要么给 nginx 加 `grpc_pass`。

11. **TLS 证书的 CN/SAN 必须匹配客户端连接时用的地址。** 本地用 `localhost:50051` 连，证书的 SAN 里必须有 `localhost`；用 `127.0.0.1` 连，SAN 里要有 `127.0.0.1`（IP SAN，不是 DNS SAN）。自签证书最容易在这里卡住，错误是 `x509: certificate is valid for ... not ...`。

12. **`internals` 目录不是 Go 的 `internal`。** 讲师用的 `internals`（复数）**不触发** Go 的 internal 包规则——任何外部模块都能 import 它。想真正限制可见性，目录必须叫 `internal`（单数）。这是课里的一个笔误级问题，但你照抄会失去封装。

13. **MongoDB 的 `_id` 不能是数组。** 这是唯一一条硬限制：`_id` 可以是任何 BSON 类型（除了数组），包括嵌套文档。用嵌套文档做复合主键（`{studentId, execId}`）是合法的，但要注意**字段顺序会影响唯一性**（`{a:1, b:2}` 和 `{b:2, a:1}` 是不同文档）。

这 13 条里有 5 条（2、3、6、8、9）会直接表现为「按教程做了但不工作」，而且是 MongoDB 和 gRPC 各自生态里最典型的「版本/写法差异」。P054–P058 把环境和协议层搭完了，真正的坑要在 P059 开始写 handler 时才会集中爆发。