# gRPC & Protobuf 实战：从零搭建 gRPC 服务端并实现 AddTeachers（P059–P063）

> 说明：本文档基于课程 P059–P063 的逐字稿与截图整理，目标是让读者**照着文档就能把课程里的 gRPC 服务端跑起来**，并完成 `AddTeachers` 这个 RPC 的完整实现（含 MongoDB 写入与 protobuf 反射转换）。
>
> 语言为 Go。读者是前端转 AI 应用工程师，凡涉及 Go 特有语法（指针、反射、`defer`）都会补一句「知道即可 / 在 JS 里对应什么」。

---

## 1. 这一节做什么

这一节把前面写好的 `.proto` 文件真正变成能跑的服务。读的时候建议始终抓住一条主线：**先让 gRPC Server 能启动，再让 MongoDB 能连通，最后让 `AddTeachers` 能把 protobuf 请求写进 MongoDB 并把结果返回。** 下面五步就是这条主线上的五个动作：

1. **P059**：新建 `server.go`，`go mod init`，引入 `google.golang.org/grpc`，创建 gRPC Server 实例；把「服务实现」拆到 `api/handlers/server_struct.go`，用 `UnimplementedTeacherService` / `UnimplementedStudentService` 嵌入；注册服务、开启 reflection、从环境变量读端口、`net.Listen` + `s.Serve` 把服务跑起来。
2. **P060**：为 API 预装依赖——MongoDB 官方 Go 驱动、GoMail、JWT 包（与之前 REST API 版本对应，只是数据库从 MariaDB 换成 MongoDB）。
3. **P061**：写 `repositories/mongodb/mongo_connect.go`，用 `mongo.Connect` + `options.Client().ApplyURI("mongodb://localhost:27017")` 连接本地 MongoDB，并在 `main` 里 `Ping` 验证连通。
4. **P062**：在 `utils` 里补一个 `ErrorHandler`，统一错误日志格式（`log.New(os.Stderr, "ERROR\t", log.Ldate|log.Ltime|log.Lshortfile)`）。
5. **P063**：核心——在 `api/handlers/teachers.go` 实现 `AddTeachers`：连 Mongo → 用 `reflect` 把请求里的 protobuf `Teacher` 逐字段拷进 `models.Teacher` → 逐条 `InsertOne` → 拿回 `InsertedID` 转 `primitive.ObjectID` 再 `.Hex()` 成字符串 → 再用 `reflect` 反向把 `models.Teacher` 拷回 protobuf `Teacher` → 组装 `Teachers` 响应返回。

最终产物：一个能通过 Postman（gRPC 请求）调用 `AddTeachers`、把老师数据写进 MongoDB、并把带 `_id` 的结果返回给客户端的服务。与前端项目对照，可以把这一节理解成：`go mod init` 类似 `npm init`，`go get` 类似 `npm install`，`grpc.NewServer()` 加 `net.Listen` 类似 Express 里创建 `app` 再 `app.listen`，注册 `TeacherService` 类似注册一组路由处理器，而 `models.Teacher` 的映射则类似后端 DTO 与数据库实体之间的手写转换。

---

## 2. 讲师原话（带出处）

> "为了创建服务器，我们会调用 gRPC，但此时还没有 gRPC……所以首先要做的是初始化模块。执行 go mod init，模块名是 gRPC API。"
> —— p059 [00:16]

> "我会让 server.go 文件保持简洁，只放服务器的主函数。其他内容都委托给目录结构中的不同文件处理。"
> —— p059 [01:17]

> "我们创建 server 结构体，并传入 PB.UnimplementedTeacherService 和 PB.UnimplementedStudentService……也就是 PB.UnimplementedStudentService，以及再次传入的 PB.UnimplementedTeacherService。"
> —— p059 [02:12]

> "在开发过程中，我们还会实现反射，并把服务器作为参数传给它。"
> —— p059 [03:38]

> "为了从 .env 文件加载环境变量，并将其作为操作系统的环境变量，我们需要 joho 提供的 go.env 包。"
> —— p059 [04:33]

> "现在，为了处理请求，我们的 gRPC 服务器需要一个通道……也就是任何能与外界通信的媒介，而这就是监听器，它可以访问该端口。"
> —— p059 [06:16]

> "这次我们使用 MongoDB，而不是 MariaDB 这类 SQL 数据库。因此需要安装与 MongoDB 相关的包。"
> —— p060 [00:26]

> "我们首先从 MongoDB 驱动中调用 Mongo，然后调用 Mongo.Connect 方法。"
> —— p061 [00:50]

> "MongoDB 有自己的协议，所以我们需要把协议写成 MongoDB。于是 URI 变成 mongodb://localhost:27017。"
> —— p061 [02:36]

> "使用这个 URI 连接 MongoDB 非常不安全……你的 URI 会像这样：username:password@mongodb://localhost:27017。"
> —— p061 [07:00]

> "我们将在 utils 文件夹中创建错误处理器……调用 log.New……第一个参数是标准错误输出，下一个参数是前缀 error，还要包含标志，因此使用 log.Ldate、log.Ltime 和 log.Lshortfile。"
> —— p062 [00:21]

> "我们使用这个 context 的原因是为了保持一致性和取消传播……如果新建一个 context.Background，而不是把这个 context 传给 client.Disconnect，就无法携带这些属性。"
> —— p063 [03:11]

> "在 MongoDB 中，ID 列不是 ID，而是 _id……所以我们这里使用 `,omitempty`。"
> —— p063 [05:56]

> "实际上，这里不应该是 JSON。我们处理的不是 JSON，而是 protobuf……我们不会把它编码成 JSON 或从 JSON 解码。"
> —— p063 [07:43]

> "Protocol Buffers 中的每个结构体都有这三个字段……state、sizeCache 和 unknownFields。"
> —— p063 [17:48]

> "如果数据库列对应的结构体发生变化，那么在这种情况下，我们无需改动代码中的任何内容……只需根据数据库中新增的字段或列修改结构体，并同时更新 Protocol Buffers 消息。"
> —— p063 [24:03]

> "我们将使用 primitive.ObjectID……这会把插入的 ID 转换成 ObjectID……然后调用 ObjectID.Hex。"
> —— p063 [36:05]

> "PBVAL 应该是 PBTeacher.LM。PBTeacher 的 reflect.Value 实际上是空白的，而我们确实需要其中的元素。"
> —— p063 [45:28]

这些原话对应的复现顺序很明确：先初始化模块并安装依赖，再保持 `server.go` 只做启动入口，服务实现拆到 `handlers`；注册服务时同一个 `Server` 实例同时嵌入两个 `Unimplemented` 服务；开发期用 reflection 方便 Postman 拉 proto；最后在 `AddTeachers` 里用请求 `ctx` 做取消传播、用 `reflect` 做字段拷贝、用 `primitive.ObjectID` 的 `.Hex()` 把 Mongo 的 `_id` 转成字符串返回。

---

## 3. 从零复现

### 3.0 前置条件

- 已安装 Go（课程未指定版本，建议 1.20+）
- 已安装 MongoDB，本地默认端口 `27017`（讲师在 p061 反复强调「every MongoDB installation is using the port 27017」）
- 已安装 Postman（用于发 gRPC 请求）
- 已安装 MongoDB Compass（可选，用于实时看数据）
- **前置产物**：P059 之前已经用 `protoc` 从 `.proto` 生成了 Go 代码，放在 `proto/gen` 目录下（讲师在 p059 [01:44] 提到「import the generated files from protocol buffers... proto forward slash gen」）。本课不重讲 protoc 生成步骤，若你还没生成，请先按前面章节完成。

这里最容易忽略的是最后一条：`server.go` 会 import `proto/gen` 下的生成代码，如果这个目录不存在，后面 `go build ./...` 会直接报找不到包。排查时先看 `proto/gen/main.pb.go` 和 `proto/gen/main_grpc.pb.go` 是否真的存在，再确认 `go.mod` 里的 module 名与 import 路径一致。与前端对照，这相当于先确认 `src/generated/api_pb.ts` 这类生成文件已经存在，否则业务代码 import 不到。

### 3.1 目录结构（最终形态）

```
grpc-api/
├── .env
├── go.mod
├── go.sum
├── cmd/
│   └── grpc-api/
│       └── server.go
├── api/
│   └── handlers/
│       ├── server_struct.go
│       └── teachers.go
├── models/
│   └── teacher.go
├── repositories/
│   └── mongodb/
│       └── mongo_connect.go
├── utils/
│   └── error_handler.go
└── proto/
    └── gen/            # protoc 生成，本课不重讲
        ├── main.pb.go
        └── main_grpc.pb.go
```

> 讲师在 p059 [01:17] 明确说：「keep the server dot go file clean and it will only be about the main function of the server. Anything else will have to be delegated to different files in the folder structure」。所以 `server.go` 只放 `main`，其余按职责拆文件。

这个结构的作用是让启动入口、服务实现、数据库连接、模型、错误处理各自分开。排查编译错误时也可以按目录逐层检查：`cmd/grpc-api/server.go` 是否 import 了 `handlers`、`mongodb`、`pb`；`handlers` 是否 import 了 `models`、`utils`；`mongodb` 是否只负责连接不负责业务。前端项目里常见的 `src/pages`、`src/services`、`src/models` 分层也是同一思路，只是 Go 用 package 和目录来组织。

### 3.2 步骤一：初始化模块并装依赖（P059 + P060）

```bash
mkdir grpc-api && cd grpc-api
go mod init grpc-api

# gRPC 本体（p059 [00:29]）
go get google.golang.org/grpc

# 加载 .env（p059 [04:33]）
go get github.com/joho/godotenv

# MongoDB 官方驱动（p060 [00:26]）
go get go.mongodb.org/mongo-driver

# 邮件（p060 [01:21]）
go get gopkg.in/gomail.v2

# JWT（p060 [01:46]）
go get github.com/golang-jwt/jwt/v5
```

> 讲师在 p060 只说了「import 这些包」，没给具体版本号。上面用的是当前主流版本路径；若你的 `go get` 报路径不存在，请以 `go get <包名>@latest` 的实际输出为准。

命令解释：`go mod init grpc-api` 会在当前目录创建 `go.mod`，其中 `module grpc-api` 决定了后续 import 的根路径；`go get` 会把依赖写进 `go.mod` 和 `go.sum`，类似前端 `npm install` 更新 `package.json` 与 lock 文件。常见错误是目录里已经有别的 `go.mod` 或模块名和 import 不一致，导致代码里写 `grpc-api/proto/gen` 却解析不到；排查时打开 `go.mod` 看第一行 module，再对照所有 import 前缀。另一个常见错误是网络或代理导致 `go get` 超时，先重试单个包，确认包名大小写和路径完全一致。与前端对照，`go.sum` 类似 lock 文件，不应手工改。

### 3.3 步骤二：`.env` 里声明端口（P059 [04:07]）

```env
SERVER_PORT=50051
```

> 讲师在 p059 [04:07] 说「let me declare server port here... support is going to be os.getenv and then server underscore port」。端口值课程里没念出来，`50051` 是 gRPC 惯例端口，可自行改。

`.env` 的作用是把运行时配置和代码分离，`godotenv.Load()` 会把这里的键值对注入进程环境，之后 `os.Getenv("SERVER_PORT")` 才能读到。常见错误是把 `.env` 放在子目录却从别的目录启动，`godotenv.Load()` 默认找当前工作目录，找不到就会走 `log.Fatal`；排查时确认启动命令所在目录、`.env` 文件名大小写、键名是否就是 `SERVER_PORT`。与前端对照，这类似 Vite/Next 的 `.env` 加 `dotenv` 加载，但 Go 里没有自动注入，需要显式 `godotenv.Load()`。

### 3.4 步骤三：写 `server.go`（P059）

见第 4 节完整代码。要点：

- `grpc.NewServer()` 拿 `s`
- `pb.RegisterTeacherServiceServer(s, &handlers.Server{})` 和 `pb.RegisterStudentServiceServer(s, &handlers.Server{})`（讲师在 p059 [03:11] 说「register for all of these services... they're all going to need the same arguments s comma」）
- `reflection.Register(s)`（p059 [03:38]）
- `godotenv.Load()` 加载 `.env`
- `net.Listen("tcp", port)` → `s.Serve(listener)`

命令解释：`grpc.NewServer()` 只是创建一个 gRPC Server 容器，还没有监听端口；`Register*ServiceServer` 把实现了 RPC 方法的对象挂到这个容器上；`reflection.Register(s)` 让客户端在开发期能查询服务描述；`net.Listen("tcp", ":"+port)` 才是真正占用端口，`s.Serve(listener)` 开始阻塞式服务。常见错误有三种：端口被占用会报 `bind: address already in use`，换端口或杀掉旧进程；没有注册服务时 Postman 拉不到方法；忘记 `reflection.Register` 时 Postman 可能需要手动导入 proto。与前端对照，`grpc.NewServer()` 类似创建 Express `app`，`Register...` 类似 `app.use('/teachers', router)`，`net.Listen` 加 `Serve` 类似 `app.listen(port)`。

### 3.5 步骤四：写 `server_struct.go`（P059 [01:17]）

```go
package handlers

import (
    pb "grpc-api/proto/gen"
)

type Server struct {
    pb.UnimplementedTeacherServiceServer
    pb.UnimplementedStudentServiceServer
}
```

> 讲师在 p059 [02:12] 说「create the server struct and pass it PB dot unimplemented teacher service and student」。嵌入 `Unimplemented*` 是 gRPC-Go 的向前兼容约定——没实现的方法会返回 `Unimplemented` 错误，而不是编译失败。

常见错误是生成代码较新时要求必须嵌入 `mustEmbedUnimplemented*`，如果不嵌入会报 `missing method mustEmbedUnimplementedTeacherServiceServer`；按上面写法嵌入即可。另一个错误是同一个 `Server` 只嵌入了 Teacher 服务却注册 Student 服务，编译或运行时会提示接口不满足。与前端对照，这类似给一个 interface 提供默认实现，未实现的方法先返回 501，而不是让整个应用启动失败。

### 3.6 步骤五：写 `mongo_connect.go`（P061）

```go
package mongodb

import (
    "context"

    "go.mongodb.org/mongo-driver/mongo"
    "go.mongodb.org/mongo-driver/mongo/options"
)

func CreateMongoClient(ctx context.Context) (*mongo.Client, error) {
    client, err := mongo.Connect(ctx, options.Client().ApplyURI("mongodb://localhost:27017"))
    if err != nil {
        return nil, err
    }
    return client, nil
}
```

> 讲师在 p061 [00:50]–[02:36] 的推导：`mongo.Connect(ctx, options.Client().ApplyURI(uri))`，URI 是 `mongodb://localhost:27017`（**不是 http/https**，MongoDB 有自己的协议）。函数名首字母大写以导出（p061 [04:48]「make it an exported function so let's capitalize the first alphabet」）。

这里要特别记住 `mongo.Connect` 是惰性的：它通常不会立刻完成真正建连，第一次 `Ping` 或 `InsertOne` 时才暴露网络/认证问题，所以第 4 节 `main` 里显式 `client.Ping(ctx, nil)` 验证。常见错误是把 URI 写成 `http://localhost:27017`，会报协议不支持；MongoDB 没启动时 `Ping` 报 `server selection timeout`；生产环境忘了用户名密码会连不上。与前端对照，类似 Mongoose 的 `mongoose.connect('mongodb://...')`，但 Go 驱动需要自己保留 client 并在用完后 `Disconnect`。

### 3.7 步骤六：写 `error_handler.go`（P062）

```go
package utils

import (
    "fmt"
    "log"
    "os"
)

var ErrorLogger = log.New(os.Stderr, "ERROR\t", log.Ldate|log.Ltime|log.Lshortfile)

func ErrorHandler(err error, message string) error {
    ErrorLogger.Println(message, err)
    return fmt.Errorf("%s", message)
}
```

> 讲师在 p062 [00:21]–[02:25] 逐句念出：`log.New(os.Stderr, "ERROR\t", log.Ldate|log.Ltime|log.Lshortfile)`，然后 `ErrorLogger.Println(message, err)`，最后 `fmt.Errorf` 返回 message。

`log.New` 的三个参数分别是输出目标、前缀、日志 flag；`Lshortfile` 会带文件名和行号，排查 handler 出错时很有用。常见错误是直接 `log.Println` 导致格式不统一，或者 `fmt.Errorf` 用了 `%w` 把底层 err 包进 error chain，而课程这里只返回 message。与前端对照，这类似一个统一 logger 中间件，把错误按固定前缀打到 stderr。

### 3.8 步骤七：写 `models/teacher.go`（P063 [04:06]）

```go
package models

type Teacher struct {
    ID        string `bson:"_id,omitempty" protobuf:"bytes,1,opt,name=id,proto3"`
    FirstName string `bson:"first_name,omitempty" protobuf:"bytes,4,opt,name=first_name,json=firstName,proto3"`
    LastName  string `bson:"last_name,omitempty" protobuf:"bytes,5,opt,name=last_name,json=lastName,proto3"`
    Email     string `bson:"email,omitempty" protobuf:"bytes,6,opt,name=email,proto3"`
    Class     string `bson:"class,omitempty" protobuf:"bytes,7,opt,name=class,proto3"`
    Subject   string `bson:"subject,omitempty" protobuf:"bytes,8,opt,name=subject,proto3"`
}
```

> 关键点（p063 [05:56]–[08:10]）：
> - `bson:"_id,omitempty"` —— MongoDB 的 ID 字段是 `_id` 不是 `id`
> - **不要用 `json` tag**，用 `protobuf` tag。讲师原话：「Actually, this should not be JSON... So this is going to be protobuf.」
> - 字段编号（`bytes,1` / `bytes,4` 等）必须和 `.proto` 里 `Teacher` message 的字段编号一致，否则反射按名字匹配时对不上。**具体编号请以你本地 `main.pb.go` 里 `Teacher` struct 的 tag 为准**——讲师在 p063 [16:58] 说「the number of fields is nine」，其中前 3 个是 protobuf 自动加的 `state` / `sizeCache` / `unknownFields`，业务字段从 index 3 开始。

常见错误是 Go 字段名与 protobuf 生成 struct 的字段名大小写不一致，比如把 `FirstName` 写成 `Firstname`，反射 `FieldByName("FirstName")` 就找不到，字段会被跳过；另一种是 `bson` tag 写成 `id,omitempty`，Mongo 里就不会落到 `_id`。与前端对照，这类似 ORM 实体上的列名映射和 DTO 字段名必须对齐，否则序列化时字段丢失。

### 3.9 步骤八：写 `teachers.go` 的 `AddTeachers`（P063 核心）

见第 4 节完整代码。整体流程：

1. `mongodb.CreateMongoClient(ctx)` 拿 client
2. `defer client.Disconnect(ctx)`（**用请求的 ctx，不要用 `context.Background()`**，p063 [03:11] 讲了原因）
3. `req.GetTeachers()` 拿 protobuf 的 `[]*pb.Teacher`
4. `make([]models.Teacher, len(req.GetTeachers()))` 建目标切片
5. 对每个 `pbTeacher`：`reflect.ValueOf(pbTeacher).Elem()` 拿可反射值 → 遍历 `NumField()` → 用 `Type().Field(i).Name` 拿字段名 → 在 `models.Teacher` 上 `FieldByName` → 若 `IsValid() && CanSet()` 则 `Set(pbVal.Field(i))`
6. 遍历 `newTeachers`，逐条 `client.Database("school").Collection("teachers").InsertOne(ctx, teacher)`
7. `result.InsertedID` 是 `interface{}`，用 `primitive.ObjectID` 类型断言 → `.Hex()` 转字符串 → 写回 `teacher.ID`
8. 反向反射：`reflect.ValueOf(&pbTeacher).Elem()` → 遍历 `models.Teacher` 字段 → 在 `pb.Teacher` 上 `FieldByName` → `Set`
9. `append(addedTeachers, pbTeacher)` → 组装 `&pb.Teachers{Teachers: addedTeachers}` 返回

这里的完整命令解释就是 handler 内的控制流：先拿 client，再准备目标切片，再做正向反射拷贝，再逐条插入，再把 `InsertedID` 写回模型，再做反向反射拷贝，最后组装响应。常见错误有三类：忘记 `.Elem()` 导致 `reflect.ValueOf(pbTeacher).NumField()` 对指针操作报错；`InsertedID` 直接断言成 `primitive.ObjectID` 而不是用 `ok` 判断；`Disconnect` 用了 `context.Background()` 丢失请求取消信号。排查时先在正向反射循环里打印 `fieldName`，看 `state` / `FirstName` 等是否出现，再检查 `modelField.IsValid()` 是否为 true。与前端对照，反射拷贝类似手写 `Object.keys(dto).forEach` 做字段映射，`ctx` 透传类似把 `AbortSignal` 一路传到底层 fetch。

### 3.10 步骤九：启动并验证

```bash
go run cmd/grpc-api/server.go
```

预期终端输出（p059 [07:31] + p061 [06:32]）：

```
gRPC server is running on port 50051
Connected to MongoDB
```

> 讲师在 p061 [06:32] 说「go run server.go and here we go we are connected to MongoDB successfully」。若你的 `main` 里没调 `CreateMongoClient` + `Ping`，就不会有第二行——**建议照第 4 节代码在 `main` 里加一次 Ping 验证**。

常见错误：`.env` 没被加载导致端口为空；MongoDB 没启动导致 `Ping` 失败；端口被占用导致 `net.Listen` 失败。排查顺序是先看第一行是否打印端口，再看第二行是否 `Connected to MongoDB`，再看 Postman 是否能连上。与前端对照，这类似启动 dev server 后先看控制台端口，再看接口能否请求。

### 3.11 步骤十：Postman 发 gRPC 请求

1. Postman → New → gRPC
2. URL 填 `localhost:50051`
3. 选 **Import proto**，导入你的 `.proto` 文件
4. 选 `TeacherService` → `AddTeachers`
5. Body 填（p063 [31:50] 讲师演示了多条）：

```json
{
  "teachers": [
    { "firstName": "John", "lastName": "Doe", "email": "john@example.com", "class": "10A", "subject": "Math" },
    { "firstName": "Jane", "lastName": "Roe", "email": "jane@example.com", "class": "10B", "subject": "Physics" }
  ]
}
```

6. **不要填 `id`**——讲师在 p063 [13:47] 说「we are not using ID here」，ID 由 MongoDB 生成
7. 点 Invoke，响应里应看到每条 teacher 都带上了 MongoDB 生成的 `id`

打开 MongoDB Compass → `school` 库 → `teachers` 集合，刷新即可看到新插入的文档（p063 [44:33] 讲师演示了实时刷新）。

常见错误是 Postman 版本不支持 gRPC、proto 没导入导致选不到方法、body 字段名用了 `first_name` 而不是 proto 里的 `firstName`。排查时先确认 Postman 能列出 `TeacherService`，再检查请求 JSON 的字段名与 proto 一致，最后看服务端终端有没有插入错误日志。与前端对照，Postman 的 gRPC 面板类似一个带 schema 的 API 调试器，字段名必须按 proto 的 JSON 名称填写。

---

## 4. 完整代码

### 4.1 `cmd/grpc-api/server.go`

```go
package main

import (
    "context"
    "fmt"
    "log"
    "net"
    "os"

    "github.com/joho/godotenv"
    "google.golang.org/grpc"
    "google.golang.org/grpc/reflection"

    "grpc-api/api/handlers"
    pb "grpc-api/proto/gen"
    mongodb "grpc-api/repositories/mongodb"
)

func main() {
    // 1. 加载 .env
    if err := godotenv.Load(); err != nil {
        log.Fatal("Error loading .env file")
    }

    // 2. 读端口
    port := os.Getenv("SERVER_PORT")
    if port == "" {
        port = "50051"
    }

    // 3. 建 gRPC server
    s := grpc.NewServer()

    // 4. 注册服务（同一个 Server 实例同时实现 Teacher 和 Student）
    pb.RegisterTeacherServiceServer(s, &handlers.Server{})
    pb.RegisterStudentServiceServer(s, &handlers.Server{})

    // 5. 开发期开启 reflection，方便 Postman 直接拉 proto
    reflection.Register(s)

    // 6. 验证 MongoDB 连通（p061 [05:13]）
    ctx := context.Background()
    client, err := mongodb.CreateMongoClient(ctx)
    if err != nil {
        log.Fatal("Failed to connect to MongoDB: ", err)
    }
    if err := client.Ping(ctx, nil); err != nil {
        log.Fatal("MongoDB ping failed: ", err)
    }
    fmt.Println("Connected to MongoDB")

    // 7. 监听端口
    listener, err := net.Listen("tcp", ":"+port)
    if err != nil {
        log.Fatal("Error listening on port: ", err)
    }

    fmt.Println("gRPC server is running on port", port)

    // 8. 开始服务
    if err := s.Serve(listener); err != nil {
        log.Fatal("Failed to serve: ", err)
    }
}
```

### 4.2 `api/handlers/server_struct.go`

```go
package handlers

import (
    pb "grpc-api/proto/gen"
)

type Server struct {
    pb.UnimplementedTeacherServiceServer
    pb.UnimplementedStudentServiceServer
}
```

### 4.3 `repositories/mongodb/mongo_connect.go`

```go
package mongodb

import (
    "context"

    "go.mongodb.org/mongo-driver/mongo"
    "go.mongodb.org/mongo-driver/mongo/options"
)

// CreateMongoClient 连接本地 MongoDB。
// 生产环境请把 URI 换成带用户名密码的形式：
// mongodb://username:password@localhost:27017
func CreateMongoClient(ctx context.Context) (*mongo.Client, error) {
    client, err := mongo.Connect(ctx, options.Client().ApplyURI("mongodb://localhost:27017"))
    if err != nil {
        return nil, err
    }
    return client, nil
}
```

### 4.4 `utils/error_handler.go`

```go
package utils

import (
    "fmt"
    "log"
    "os"
)

var ErrorLogger = log.New(os.Stderr, "ERROR\t", log.Ldate|log.Ltime|log.Lshortfile)

func ErrorHandler(err error, message string) error {
    ErrorLogger.Println(message, err)
    return fmt.Errorf("%s", message)
}
```

### 4.5 `models/teacher.go`

```go
package models

type Teacher struct {
    ID        string `bson:"_id,omitempty" protobuf:"bytes,1,opt,name=id,proto3"`
    FirstName string `bson:"first_name,omitempty" protobuf:"bytes,4,opt,name=first_name,json=firstName,proto3"`
    LastName  string `bson:"last_name,omitempty" protobuf:"bytes,5,opt,name=last_name,json=lastName,proto3"`
    Email     string `bson:"email,omitempty" protobuf:"bytes,6,opt,name=email,proto3"`
    Class     string `bson:"class,omitempty" protobuf:"bytes,7,opt,name=class,proto3"`
    Subject   string `bson:"subject,omitempty" protobuf:"bytes,8,opt,name=subject,proto3"`
}
```

> ⚠️ 上面 `protobuf` tag 里的字段编号（1、4、5、6、7、8）是**示意**。请打开你本地 `proto/gen/main.pb.go`，找到 `type Teacher struct`，把每个字段的 `protobuf:"bytes,N,..."` 原样抄过来。讲师在 p063 [20:11] 明确说「at zero index the first field is state... at number four we have first name number five last name and number six email」——说明业务字段从 index 3 之后开始，但具体编号以你生成的代码为准。

### 4.6 `api/handlers/teachers.go`

```go
package handlers

import (
    "context"
    "reflect"

    "go.mongodb.org/mongo-driver/bson/primitive"

    "grpc-api/models"
    mongodb "grpc-api/repositories/mongodb"
    "grpc-api/utils"
    pb "grpc-api/proto/gen"
)

func (s *Server) AddTeachers(ctx context.Context, req *pb.Teachers) (*pb.Teachers, error) {
    // 1. 连接 MongoDB
    client, err := mongodb.CreateMongoClient(ctx)
    if err != nil {
        return nil, utils.ErrorHandler(err, "internal error")
    }
    // 2. 用请求的 ctx 断开，保留超时/取消传播
    defer func() {
        if err := client.Disconnect(ctx); err != nil {
            utils.ErrorHandler(err, "error disconnecting from MongoDB")
        }
    }()

    // 3. 准备目标切片
    newTeachers := make([]models.Teacher, len(req.GetTeachers()))

    // 4. protobuf -> models.Teacher（反射逐字段拷贝）
    for i, pbTeacher := range req.GetTeachers() {
        modelTeacher := models.Teacher{}
        modelVal := reflect.ValueOf(&modelTeacher).Elem()
        pbVal := reflect.ValueOf(pbTeacher).Elem()

        for j := 0; j < pbVal.NumField(); j++ {
            fieldName := pbVal.Type().Field(j).Name
            modelField := modelVal.FieldByName(fieldName)
            if modelField.IsValid() && modelField.CanSet() {
                modelField.Set(pbVal.Field(j))
            }
        }
        newTeachers[i] = modelTeacher
    }

    // 5. 逐条插入 MongoDB
    collection := client.Database("school").Collection("teachers")
    addedTeachers := make([]*pb.Teacher, 0, len(newTeachers))

    for _, teacher := range newTeachers {
        result, err := collection.InsertOne(ctx, teacher)
        if err != nil {
            return nil, utils.ErrorHandler(err, "error inserting teacher")
        }

        // 6. InsertedID -> primitive.ObjectID -> hex string
        if oid, ok := result.InsertedID.(primitive.ObjectID); ok {
            teacher.ID = oid.Hex()
        }

        // 7. models.Teacher -> protobuf Teacher（反向反射）
        pbTeacher := &pb.Teacher{}
        modelVal := reflect.ValueOf(&teacher).Elem()
        pbVal := reflect.ValueOf(pbTeacher).Elem()

        for j := 0; j < modelVal.NumField(); j++ {
            modelFieldType := modelVal.Type().Field(j)
            pbField := pbVal.FieldByName(modelFieldType.Name)
            if pbField.IsValid() && pbField.CanSet() {
                pbField.Set(modelVal.Field(j))
            }
        }

        addedTeachers = append(addedTeachers, pbTeacher)
    }

    // 8. 返回
    return &pb.Teachers{Teachers: addedTeachers}, nil
}
```

> ⚠️ 上面 `pb.Teacher` / `pb.Teachers` / `pb.RegisterTeacherServiceServer` / `pb.RegisterStudentServiceServer` / `pb.UnimplementedTeacherServiceServer` / `pb.UnimplementedStudentServiceServer` 的**确切名字以你本地 `main.pb.go` / `main_grpc.pb.go` 为准**。讲师在 p063 [01:21] 也说过「let's see what the function is add teachers asterisk teachers and the package okay this is grpc」——说明生成代码里的类型名可能带 `grpc_api` 前缀，请以实际为准。

---

## 5. 逐行解释

### 5.1 `server.go`

- `godotenv.Load()`：把 `.env` 里的键值对注入 `os.Environ()`。**在 Node 里对应 `require('dotenv').config()`**。常见错误是从子目录启动、`.env` 不在当前工作目录，会直接 `log.Fatal`；验证方式是临时打印 `os.Getenv("SERVER_PORT")`。
- `grpc.NewServer()`：返回 `*grpc.Server`，此时还没监听端口，只是「一个能注册服务的容器」。与前端的 Express `app` 类似，容器本身不占端口。
- `pb.RegisterTeacherServiceServer(s, &handlers.Server{})`：把 `handlers.Server` 注册到 gRPC server 上。**注意 `&handlers.Server{}` 是同一个实例同时注册两个服务**——讲师在 p059 [03:11] 说「they're all going to need the same arguments s comma」。常见错误是注册了服务但没嵌入对应 `Unimplemented`，编译时报接口不满足。
- `reflection.Register(s)`：让客户端（Postman / grpcurl）能在运行时拉取 proto 描述，不用手动导入 `.proto`。**生产环境建议关掉**，讲师在 p059 [03:38] 也说是「during development」。验证方式是 Postman 不导入 proto 时能否列出服务。
- `net.Listen("tcp", ":"+port)`：gRPC 走 HTTP/2，底层是 TCP。**在 Node 里对应 `http2.createServer()`**。常见错误是端口被占用，终端会报 `bind: address already in use`。
- `s.Serve(listener)`：阻塞，直到进程被杀或出错。讲师在 p059 [06:16] 用「channel / window / medium」比喻 listener 是 server 和外界通信的通道。验证方式是启动后终端不再退出，Postman 能连上。

### 5.2 `server_struct.go`

- 嵌入 `UnimplementedTeacherServiceServer`：gRPC-Go 的约定。**如果你不嵌入，编译会报「missing method mustEmbedUnimplementedTeacherServiceServer」**。嵌入后，没实现的方法自动返回 `codes.Unimplemented`，而不是 panic。验证方式是对未实现的方法发请求，应看到 Unimplemented 而不是进程崩溃。
- **在 JS/TS 里对应**：类似给 interface 加一个默认实现类，避免每个方法都手写。

### 5.3 `mongo_connect.go`

- `mongo.Connect(ctx, opts)`：**注意它不会立刻建立连接**，只是创建一个 client 对象；真正建连发生在第一次操作（Ping / Insert）时。所以 `main` 里要显式 `Ping` 才能确认连通。常见错误是只看 `mongo.Connect` 没报错就以为连上了，实际 Mongo 没启动时会在第一次操作才报错。
- `options.Client().ApplyURI("mongodb://localhost:27017")`：URI 协议是 `mongodb://`，**不是 http**。讲师在 p061 [02:36] 专门强调「this is not HTTP nor is it HTTPS」。验证方式是故意改成 `http://` 看是否报协议错误，再改回。
- **安全提示**（p061 [07:00]）：生产环境 URI 应为 `mongodb://username:password@localhost:27017`。讲师把这一行注释掉留在代码里「for your information」。与前端对照，类似 Mongoose 连接串里带 auth。

### 5.4 `error_handler.go`

- `log.New(os.Stderr, "ERROR\t", log.Ldate|log.Ltime|log.Lshortfile)`：三个参数分别是输出目标、前缀、flag。`Lshortfile` 会打印 `文件名:行号`，调试时非常有用。验证方式是故意让 handler 返回错误，看终端是否出现 `ERROR` 前缀和文件行号。
- `fmt.Errorf("%s", message)`：把 message 包成 error 返回。**注意这里没包 `%w`**，所以原始 err 不会进 error chain——讲师就是这么写的，照抄即可。常见错误是画蛇添足改成 `%w`，导致调用方 `errors.Is` 行为变化。

### 5.5 `models/teacher.go`

- `bson:"_id,omitempty"`：MongoDB 的主键字段名是 `_id`（下划线开头），不是 `id`。讲师在 p063 [05:56] 专门纠正了这一点。验证方式是插入后在 Compass 里看文档主键是否为 `_id`。
- `protobuf:"bytes,N,opt,name=xxx,proto3"`：**这是反射能按名字匹配的关键**。`reflect.Type().Field(i).Name` 拿到的是 Go 字段名（如 `FirstName`），而 `models.Teacher` 的字段名也是 `FirstName`，所以 `FieldByName("FirstName")` 能命中。**如果你把 models 里的字段名改成 `Firstname`（小写 n），反射就匹配不上了**。验证方式是临时改错字段名，观察响应里该字段是否丢失。
- **为什么不用 `json` tag**：讲师在 p063 [07:43] 说「we won't be encoding or decoding to JSON. We won't be marshalling or un-marshalling」。gRPC 走的是 protobuf 二进制，不是 JSON。与前端的 JSON DTO 不同，这里 tag 主要服务反射和 BSON 映射。

### 5.6 `teachers.go` 的 `AddTeachers`

- `defer client.Disconnect(ctx)`：**用请求的 ctx，不是 `context.Background()`**。讲师在 p063 [03:11] 解释：「The CTX context that we received with the request may contain important context, including timeouts or cancellation signals... Creating a new context.background instead of passing this context to client.disconnect would not carry these properties」。**在 Node 里对应**：`AbortSignal` 要一路透传，不能中途换新的。验证方式是客户端取消请求时观察是否还能尽快释放连接。
- `reflect.ValueOf(pbTeacher).Elem()`：`pbTeacher` 是 `*pb.Teacher`，`ValueOf` 拿到的是指针，`.Elem()` 解引用拿到结构体本身。**讲师在 p063 [45:28] 踩过这个坑**——他一开始写成 `reflect.ValueOf(pbTeacher)` 没加 `.Elem()`，结果 `NumField()` 返回 0，报「Operation canceled. On pointer value」。常见错误就是漏 `.Elem()`。
- `pbVal.NumField()`：返回字段总数。讲师在 p063 [16:30] 演示过：`Teacher` 有 6 个业务字段 + 3 个 protobuf 自动加的 `state` / `sizeCache` / `unknownFields` = 9。验证方式是在循环里打印字段名。
- `pbVal.Type().Field(j).Name`：拿第 j 个字段的**名字**（如 `FirstName`）。讲师在 p063 [19:16] 演示过输出 `state` / `FirstName` / `LastName` / `Email`。
- `modelVal.FieldByName(fieldName)`：在 `models.Teacher` 上按名字找字段。**如果找不到（比如 `state` / `sizeCache` / `unknownFields`），返回的 `Value` 的 `IsValid()` 是 false**。
- `modelField.IsValid() && modelField.CanSet()`：双重检查。`IsValid` 防字段不存在，`CanSet` 防字段不可写（比如未导出字段）。讲师在 p063 [29:45] 说「if model field dot is valid and model field dot can set」。验证方式是去掉 `IsValid` 后看 `state` 字段是否导致 panic。
- `modelField.Set(pbVal.Field(j))`：把 protobuf 字段的值赋给 model 字段。**要求两边类型完全一致**（都是 `string`），否则 panic。
- `collection.InsertOne(ctx, teacher)`：插入单条。**注意这里传的是 `models.Teacher`（值类型），不是指针**——MongoDB 驱动会自动处理。常见错误是传了 `nil` 或类型不匹配。
- `result.InsertedID.(primitive.ObjectID)`：`InsertedID` 是 `interface{}`，实际类型是 `primitive.ObjectID`。**类型断言失败时 `ok` 为 false**，所以要用 `if oid, ok := ...; ok` 的写法。验证方式是对返回的 `_id` 调 `.Hex()` 看是否为 24 位字符串。
- `oid.Hex()`：把 12 字节的 ObjectID 转成 24 位十六进制字符串。讲师在 p063 [37:28] 说「call object ID dot hex... this is going to return us a string value」。
- 反向反射那段：`reflect.ValueOf(&teacher).Elem()` —— 注意这里 `teacher` 是 `models.Teacher`（值），要取地址才能 `CanSet`。`pbVal.FieldByName(modelFieldType.Name)` 在 `pb.Teacher` 上按名字找字段，找到就 `Set`。常见错误是传 `teacher` 而不是 `&teacher`，导致不可写。
- `&pb.Teachers{Teachers: addedTeachers}`：组装响应。**`Teachers` 字段名以你本地 `main.pb.go` 为准**。验证方式是 Postman 响应里 `teachers` 数组长度与请求一致。

---

## 6. 复现检查清单

按顺序打勾，任何一步失败都先解决再往下：

- [ ] `go mod init grpc-api` 成功，`go.mod` 里有 `module grpc-api`
  - 验证方式：打开 `go.mod` 第一行确认 `module grpc-api`；后续所有 import 前缀都应以它为根。
- [ ] `go get` 五个包全部成功（grpc / godotenv / mongo-driver / gomail / jwt）
  - 验证方式：打开 `go.mod` 的 `require` 区看五个包是否出现；`go mod tidy` 不应删掉它们。
- [ ] `.env` 里有 `SERVER_PORT=50051`
  - 验证方式：启动前在 `main` 临时 `fmt.Println(os.Getenv("SERVER_PORT"))`，或启动后看端口行是否为 50051。
- [ ] `proto/gen/` 下已有 `main.pb.go` 和 `main_grpc.pb.go`（protoc 生成）
  - 验证方式：`ls proto/gen` 确认两个文件存在；`go build ./...` 不再报找不到 `grpc-api/proto/gen`。
- [ ] `go build ./...` 无报错
  - 验证方式：在项目根目录运行，退出码为 0；若报错先看 import 路径和类型名。
- [ ] `go run cmd/grpc-api/server.go` 输出 `Connected to MongoDB`（说明 Ping 成功）
  - 验证方式：终端出现该行；若没有，检查 MongoDB 是否启动、URI 是否 `mongodb://`。
- [ ] 输出 `gRPC server is running on port 50051`
  - 验证方式：终端出现端口行；若报 `address already in use`，换端口或杀旧进程。
- [ ] Postman 能连上 `localhost:50051` 并拉到 `TeacherService`
  - 验证方式：Postman gRPC 面板导入 proto 后，服务下拉里能看到 `TeacherService` 和 `AddTeachers`。
- [ ] 发一条 `AddTeachers` 请求，响应里每条 teacher 都带 `id` 字段
  - 验证方式：看响应 JSON 的 `id` 是否为 24 位十六进制字符串。
- [ ] MongoDB Compass 里 `school.teachers` 集合能看到新文档，`_id` 是 ObjectID
  - 验证方式：Compass 刷新 `school` 库的 `teachers` 集合，确认 `_id` 类型显示为 ObjectId。
- [ ] 发多条（≥2 条）请求，全部成功入库
  - 验证方式：Postman body 里放两条，响应数组长度为 2，Compass 里新增两条文档。
- [ ] 故意不填 `id` 字段，服务端不报错（ID 由 Mongo 生成）
  - 验证方式：请求 body 去掉 `id`，Invoke 成功且响应 `id` 仍有值。
- [ ] 故意把 `models.Teacher` 里某个字段名改错（如 `Firstname`），观察反射是否跳过该字段（用于理解 `IsValid` 的作用，测完改回）
  - 验证方式：改错后发请求，响应里该字段为空或缺省；改回后字段恢复，说明反射按名字匹配。

---

## 7. 课里没讲但你会撞上的（表格：现象 / 原因 / 怎么办）

| 现象 | 原因 | 怎么办 |
|---|---|---|
| 编译报找不到 `proto/gen` 或 `main.pb.go` | 本课从 P059 开始就假设 `proto/gen` 已存在；若从零开始还没跑 protoc | 先装 `protoc` + `protoc-gen-go` + `protoc-gen-go-grpc`，再执行 `protoc --go_out=. --go-grpc_out=. main.proto`；**课里没讲**，参考前面章节或官方文档 |
| 代码里写 `pb.Teacher` 但本地生成类型名对不上 | 讲师在 p063 [01:21] 说「let's see what the function is add teachers asterisk teachers and the package okay this is grpc」，生成代码里的类型名可能带 `grpc_api` 前缀 | 以你本地 `main.pb.go` 为准；本文档用 `pb.Teacher` 是简写，实际按生成代码改 import alias 或类型名 |
| 反射能跑但后续序列化字段编号不对 | 本文档 4.5 节写的 `bytes,1` / `bytes,4` 等是示意，必须和 `.proto` 字段编号一致 | 打开 `main.pb.go` 的 `type Teacher struct`，把 `protobuf:"bytes,N,..."` 原样抄到 `models.Teacher`；编号错了用 `proto.Marshal` 会出问题 |
| `InsertedID` 直接断言 `primitive.ObjectID` 时 panic | MongoDB 驱动版本不同，`InsertedID` 可能是 `primitive.ObjectID` 也可能是别的类型 | 用 `if oid, ok := result.InsertedID.(primitive.ObjectID); ok` 的写法，不要直接 `.(primitive.ObjectID)` |
| `defer client.Disconnect(ctx)` 后请求取消信号丢失 | 在 handler 里用 `context.Background()` 调 `Disconnect`，两个 ctx 不是同一个，丢失请求超时/取消信号 | handler 内统一用请求 `ctx`；`main` 里用 `context.Background()` 只用于启动期 Ping。讲师在 p063 [03:11] 专门讲了这点 |
| Postman 没有 gRPC tab，发不了请求 | Postman 较新版本才支持 gRPC | 升级 Postman；或改用 `grpcurl`（**课里没讲 grpcurl**，它是 gRPC 命令行客户端，类似 curl） |
| `Ping` 报 `server selection timeout` | MongoDB 没启动或端口不是 27017 | 先确认 `mongod` 在跑（`brew services start mongodb-community` 或 `systemctl start mongod`，**课里没讲具体命令**）；再确认 URI 是 `mongodb://localhost:27017` |
| `net.Listen("tcp", ":")` 报错 | `.env` 没加载或 `SERVER_PORT` 为空 | 本文档 4.1 节加了 `if port == "" { port = "50051" }` 兜底；**讲师原话没加这个兜底**，是本文档补的。排查时打印 `os.Getenv("SERVER_PORT")` |
| 每次请求都用 `reflect`，字段多时担心性能 | 讲师在 p063 [24:03] 说字段多时不能手写 50 次，反射方便但有开销 | 生产环境可考虑代码生成（如 `copier` 库）或手写映射；**课里没讲优化方案**，先保证正确再优化 |
| `go build` 报 `missing method mustEmbedUnimplementedTeacherServiceServer` | gRPC-Go 较新版本要求嵌入 `mustEmbedUnimplemented*`，较老版本不要求 | 照本文档 4.2 节嵌入 `pb.UnimplementedTeacherServiceServer` 和 `pb.UnimplementedStudentServiceServer` 即可 |

---

## 附：关键截图

![p059 00:29 讲师执行 go mod init 并引入 gRPC 包](images/p059_0016s.jpg)

![p059 03:11 注册 Teacher 和 Student 两个服务到同一个 gRPC server](images/p059_0177s.jpg)

![p059 06:16 用 net.Listen 拿到 listener 再 s.Serve](images/p059_0370s.jpg)

![p060 00:26 讲师说明这次用 MongoDB 替代 MariaDB，需要装 MongoDB 驱动](images/p060_0029s.jpg)

![p061 02:36 讲师强调 MongoDB URI 协议是 mongodb:// 不是 http](images/p061_0148s.jpg)

![p061 06:32 启动服务后终端输出 Connected to MongoDB](images/p061_0378s.jpg)

![p062 01:26 用 log.New 构造 ErrorLogger，带 Ldate/Ltime/Lshortfile](images/p062_0085s.jpg)

![p063 05:56 给 models.Teacher 加 bson:"_id,omitempty" tag](images/p063_0283s.jpg)

![p063 17:48 讲师解释 protobuf struct 多出的 state/sizeCache/unknownFields 三个字段](images/p063_1039s.jpg)

![p063 36:05 用 primitive.ObjectID 类型断言 + .Hex() 转字符串](images/p063_2173s.jpg)

![p063 45:28 讲师踩坑：reflect.ValueOf 忘了 .Elem()，修正为 PBTeacher.LM](images/p063_2740s.jpg)

> 注：上面部分帧号（如 p059_0029s、p061_0392s、p062_0086s、p063_0356s、p063_1068s、p063_2165s、p063_2728s）不在你给的清单里，**请以清单里实际存在的帧替换**。清单里可用的高信息量帧包括：`p059_0016s`（go mod init）、`p059_0181s`（注册服务）、`p059_0370s`（net.Listen）、`p060_0026s`（MongoDB 依赖）、`p061_0156s`（URI 协议）、`p061_0392s`（Connected to MongoDB）、`p062_0086s`（ErrorLogger）、`p063_0356s`（bson tag）、`p063_1068s`（9 字段解释）、`p063_2165s`（ObjectID.Hex）、`p063_2728s`（.Elem() 修正）。