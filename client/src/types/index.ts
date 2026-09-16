/** Agent 回答时引用的知识树节点来源 */
export interface Citation {
  nodeId: string;
  question: string;
  score: number;
  /** vector=向量检索 keyword=关键词检索 context=祖先链路 */
  mode: string;
}

export interface KnowledgeNode {
  _id: string;
  question: string;
  answer: string;
  context?: string;
  parentId?: string;
  sessionId: string;
  createdAt: string;
  level: number; // Hierarchical level (0 for root)
  children?: KnowledgeNode[]; // For tree structure visualization
  citations?: Citation[]; // Agent 回答引用的知识来源
}

/** Agent 执行过程中向前端推送的事件（与后端 agentService.AgentEvent 对齐） */
export type AgentEvent =
  | { type: 'status'; message: string }
  | { type: 'round_start'; iteration: number }
  | { type: 'token'; content: string }
  | { type: 'round_end'; iteration: number; kind: 'thinking' | 'final' }
  | {
      type: 'action'
      id: string
      tool: string
      args: Record<string, unknown>
      iteration: number
    }
  | {
      type: 'observation'
      id: string
      tool: string
      ok: boolean
      content: string
      iteration: number
    }
  | { type: 'citations'; items: Citation[] }
  | { type: 'done'; node: KnowledgeNode; iterations: number; usedAgent: boolean }
  | { type: 'error'; message: string }
