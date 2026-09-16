# AI 学习树 · Learning Tool

把「和大模型的一次性对话」沉淀成**可追溯、可复用、可导出的知识树**。项目内置 ReAct Agent 与 RAG 检索，回答会主动检索你此前积累的笔记，并给出可点击回溯源节点的引用标注。

## 核心能力

### Agent（ReAct + 原生 Function Calling）

- 走标准 OpenAI `tools` / `tool_calls` 协议驱动大模型多轮推理，把工具执行结果回填对话上下文，直到模型给出终态回答。
- 达到最大轮次仍未收敛时，**收回工具**强制模型产出最终回答，避免死循环。
- 流式场景下按 `index` 聚合分片下发的 `tool_calls` 增量片段。
- 内置 3 个递进工具：知识树语义检索 → 节点祖先链路获取 → 联网搜索兜底。
- 工具异常统一转成结构化观察结果交回模型自主改道，不中断整个流程。

### RAG（向量检索 + 降级）

- 接入 `text-embedding-v3` 向量化，余弦相似度 + 阈值过滤召回历史笔记。
- 无向量能力时自动降级为对中文友好的 bigram 关键词检索。
- 检索结果有两种用法：作为工具供 Agent 主动调用；模型不支持工具时改为预检索注入上下文。
- 回答中的引用会回传 `nodeId`，前端可点击跳回对应知识节点。

### 前端

- 通过 SSE 实时消费 Agent 执行过程，渲染 `思考 → 调用工具 → 观察结果` 时间线。
- 对话链路可视化为 ECharts 知识树，支持平行追问 / 深入探究两种挂载模式。
- 选中回答中任意文本片段，作为下一次提问的上下文。
- 知识树本地缓存于 IndexedDB，弱网/离线可读。
- 零依赖导出：手写 CRC32 + ZIP，导出 Markdown 目录包与 XMind 文件。
- 亮色 / 暗色主题。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | Vue 3、TypeScript、Vite、Pinia、Vue Router、Element Plus、ECharts、Axios、marked |
| 后端 | Node.js (>= 20)、Express 5、TypeScript、Mongoose 9、tsx |
| 数据库 | MongoDB |
| AI | 千问 / DeepSeek / OpenAI（OpenAI 兼容协议）、Ollama（本地）、text-embedding-v3 |
| 测试与规范 | Vitest、ESLint、oxlint、Prettier |
| 部署 | Docker、Docker Compose、Nginx |

## 项目结构

```
vue-practice/
├── client/                          # 前端应用
│   ├── src/
│   │   ├── api/knowledge.ts         # 接口层：REST 调用 + SSE 事件协议解析
│   │   ├── components/
│   │   │   ├── KnowledgeTree.vue    # ECharts 知识树
│   │   │   ├── ChatBubble.vue       # 问答气泡（Markdown 渲染 / 划词 / 引用）
│   │   │   └── AgentTrace.vue       # Agent 执行轨迹时间线
│   │   ├── composables/             # 可复用逻辑
│   │   │   ├── useChat.ts           # 提问流程 + Agent 状态机
│   │   │   ├── useContext.ts        # 划词上下文管理与排序
│   │   │   ├── useExport.ts         # 导出流程
│   │   │   ├── useMountMode.ts      # 挂载位置与追问模式
│   │   │   └── useTheme.ts          # 主题切换
│   │   ├── stores/knowledge.ts      # Pinia：节点、会话、当前对话链
│   │   ├── utils/
│   │   │   ├── MemoryTree.ts        # IndexedDB 本地缓存（LRU 淘汰）
│   │   │   ├── knowledgeExport.ts   # 手写 ZIP / Markdown / XMind 导出
│   │   │   ├── treeBuilder.ts       # 扁平节点 → 树结构
│   │   │   └── knowledgeTreeChart.ts# ECharts 配置与布局
│   │   ├── types/index.ts           # 共享类型（含 AgentEvent 协议）
│   │   └── views/HomeView.vue       # 主界面（双栏 + 分隔条）
│   ├── nginx.conf                   # 生产环境静态托管 + /api 反向代理
│   └── Dockerfile
│
├── server/                          # 后端服务
│   ├── src/
│   │   ├── services/
│   │   │   ├── agentService.ts      # ReAct 主循环 + 事件协议 + 降级
│   │   │   ├── chatClient.ts        # OpenAI 兼容对话客户端（支持 Function Calling 流式）
│   │   │   ├── tools.ts             # 工具定义、参数校验与执行
│   │   │   ├── retrievalService.ts  # 向量/关键词检索、索引构建
│   │   │   ├── embeddingService.ts  # 文本向量化封装
│   │   │   ├── knowledgeService.ts  # 节点仓储（MongoDB / 内存降级）
│   │   │   └── llmService.ts        # 单轮问答（多 Provider 抽象）
│   │   ├── models/KnowledgeNode.ts  # 节点模型（向量、引用字段）
│   │   ├── routes/api.ts            # API 路由与 SSE 下发
│   │   └── index.ts                 # 启动、数据库连接、存量索引补建
│   ├── .env.example
│   └── Dockerfile
│
├── docs/                            # 重构评估与实施文档
├── docker-compose.yml               # mongo + server + client 一键编排
├── package.json                     # 根脚本：一键启动前后端 / 批量安装依赖
└── README.md
```

## 一次提问的完整链路

```
前端 useChat.handleAsk
   └─ POST /api/chat/stream (SSE)
        └─ agentService.runAgent
             ├─ [循环] chatClient.chatRound ── 模型决定是否调用工具
             │     ├─ 需要工具 → tools.executeTool → 结果回灌 messages
             │     └─ 不需要   → 该轮即最终回答，跳出循环
             ├─ knowledgeService.createNode 落库（含 citations）
             ├─ retrievalService.indexNodeEmbedding 异步建向量索引
             └─ 全程通过 SSE 推送事件
   └─ 前端按事件类型分流：思考文本 / 工具步骤 / 引用 / 最终回答
```

### SSE 事件协议

| 事件 | 含义 |
| --- | --- |
| `status` | 状态提示（降级、中断等） |
| `round_start` | 第 N 轮推理开始 |
| `token` | 模型输出的增量文本 |
| `round_end` | 第 N 轮结束，`kind` 为 `thinking`（该轮决定调工具）或 `final`（该轮即最终回答） |
| `action` | 发起一次工具调用（含工具名与参数） |
| `observation` | 工具执行结果（含成功/失败标记） |
| `citations` | 累积的引用来源 |
| `done` | 结束，携带落库后的节点、轮次与是否走 Agent |
| `error` | 执行失败 |

前端据 `round_end` 的 `kind` 把 `token` 分流到「思考过程」与「最终回答」两个区域。

## 降级策略

Agent 链路的每一环都有兜底，保证任一外部依赖不可用时功能不整体崩掉：

| 缺失项 | 行为 |
| --- | --- |
| MongoDB 未连接 | 自动切换到内存存储 |
| 模型不支持 Function Calling | 改为「预检索 + 注入上下文 + 单轮问答」 |
| 未配置 embedding key / 调用失败 | 检索降级为 bigram 关键词匹配 |
| 未配置 `TAVILY_API_KEY` | `web_search` 返回不可用提示，模型据此调整答案 |
| Agent 执行中途异常 | 中断并降级为检索增强问答，已输出内容归入思考区 |

## 快速开始

### 环境要求

- Node.js >= 20.19
- MongoDB（本地或 Atlas，**可选**：未连接时自动使用内存存储）

### 1. 安装依赖

```bash
# 在项目根目录，一次装齐根 / 前后端三处依赖
npm run install:all
```

### 2. 配置后端

```bash
cd server
cp .env.example .env
```

至少填入一个模型 Key：

```env
LLM_PROVIDER=qwen          # qwen | deepseek | openai | ollama
LLM_MODEL=qwen-plus
QWEN_API_KEY=sk-xxxxxxxx
```

> 本地 Ollama 无需 Key：把 `LLM_PROVIDER` 设为 `ollama` 并配置 `OLLAMA_API_URL` 即可。

### 3. 启动

```bash
# 根目录，前后端一起起
npm run dev

# 或分别启动
cd server && npm run dev     # http://localhost:3000
cd client && npm run dev     # http://localhost:5173
```

打开 <http://localhost:5173> 即可使用。

### 4. 前端如何找到后端

`client` 的接口地址按以下优先级解析（见 [client/src/utils/axios.ts](client/src/utils/axios.ts)）：

1. 环境变量 `VITE_API_BASE_URL`
2. 默认相对路径 `/api`，开发环境由 Vite proxy 转发、生产环境由 Nginx 转发

若后端不在默认端口，在 `client/.env` 中显式指定：

```env
VITE_API_BASE_URL=http://localhost:3001/api
```

## 环境变量

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `PORT` | 后端端口 | `3000` |
| `MONGODB_URI` | MongoDB 连接串 | `mongodb://localhost:27017/vue-practice` |
| `LLM_PROVIDER` | 模型提供方 | `qwen` |
| `LLM_MODEL` | 模型名 | `qwen-plus` |
| `QWEN_API_KEY` | 千问 Key | — |
| `QWEN_COMPATIBLE_BASE_URL` | 千问 OpenAI 兼容地址（Function Calling 必需） | dashscope compatible-mode |
| `DEEPSEEK_API_KEY` / `OPENAI_API_KEY` | 其他 Provider 的 Key | — |
| `OLLAMA_API_URL` | 本地 Ollama 地址 | `http://localhost:11434/api/chat` |
| `AGENT_ENABLED` | 是否启用 ReAct Agent 循环 | `true` |
| `AGENT_MAX_ITERATIONS` | Agent 最大推理轮次 | `5` |
| `EMBEDDING_ENABLED` | 是否启用向量化 | `true` |
| `EMBEDDING_MODEL` | 向量模型 | `text-embedding-v3` |
| `EMBEDDING_API_KEY` | 向量服务 Key，留空则复用 `QWEN_API_KEY` | — |
| `RAG_TOP_K` | 单次检索召回节点数 | `4` |
| `RAG_MIN_SCORE` | 余弦相似度阈值 | `0.3` |
| `RAG_PRERETRIEVE` | 是否在 Agent 启动前预检索并注入 | `true` |
| `TAVILY_API_KEY` | 联网搜索 Key（可选） | — |

## API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/chat` | 非流式提问，返回落库后的节点 |
| `POST` | `/api/chat/stream` | 流式提问，以 SSE 推送 Agent 完整执行过程 |
| `GET` | `/api/nodes/:sessionId` | 拉取某会话下的全部节点（扁平列表） |
| `DELETE` | `/api/nodes/:id` | 删除节点及其所有子节点 |
| `POST` | `/api/admin/reindex` | 为存量节点补建向量索引（开启 RAG 后处理老数据） |

## 测试

```bash
cd client && npm run test:run     # Vitest 单元测试
cd server && npm test             # 节点模型测试
```

## Docker 部署

```bash
# 在项目根目录，先准备好模型 Key
export QWEN_API_KEY=sk-xxxxxxxx
docker-compose up --build
```

访问 <http://localhost:8080>。编排包含三个服务：`mongo`、`server`（3000）、`client`（Nginx 静态托管 + `/api` 反向代理）。

前端也可单独走常规 Nginx 部署：`npm run build` 后把 `client/dist` 交给 Nginx，并按 [client/nginx.conf](client/nginx.conf) 配置 `/api/` 反代即可。

## 本地模型（Ollama）

1. 安装 [Ollama](https://ollama.com)，执行 `ollama run qwen2.5` 拉取模型。
2. 在 `server/.env` 中设置：
   ```env
   LLM_PROVIDER=ollama
   LLM_MODEL=qwen2.5
   ```
3. 重启后端。Ollama 不支持标准 Function Calling，此时 Agent 会自动走「预检索 + 单轮问答」的降级路径。

## 相关文档

- [重构完成报告](docs/重构完成报告.md)
- [重构实施计划](docs/重构实施计划.md)
- [重构评估 · 前端代码结构优化](docs/重构评估-前端代码结构优化.md)
