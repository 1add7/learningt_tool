# Client · AI 学习树前端

Vue 3 + TypeScript + Vite 单页应用，负责知识树可视化、对话交互与 Agent 执行过程展示。

完整的项目介绍、架构说明与后端配置见[根目录 README](../README.md)。

## 命令

```bash
npm install
npm run dev          # 开发服务器 http://localhost:5173
npm run build        # 类型检查 + 生产构建
npm run type-check   # 仅类型检查
npm run test:run     # Vitest 单元测试
npm run lint         # oxlint + eslint
npm run format       # Prettier
```

## 目录职责

| 目录 | 职责 |
| --- | --- |
| `src/api/` | 接口层，含 SSE 事件协议解析 |
| `src/components/` | 展示组件（知识树、问答气泡、Agent 轨迹） |
| `src/composables/` | 可复用逻辑（提问流程、上下文、导出、主题、挂载模式） |
| `src/stores/` | Pinia 状态：节点、会话、当前对话链 |
| `src/utils/` | 纯函数工具（树的构建与布局、IndexedDB 缓存、导出打包） |
| `src/views/` | 页面级组件 |

## 接口地址配置

接口基址按 `VITE_API_BASE_URL` → 相对路径 `/api` 的顺序解析。后端不在默认端口时，在 `.env` 中指定：

```env
VITE_API_BASE_URL=http://localhost:3001/api
```
