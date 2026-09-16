import api from '../utils/axios'
import type { AgentEvent, KnowledgeNode } from '../types'

export const getNodes = (sessionId: string) => api.get<KnowledgeNode[]>(`/nodes/${sessionId}`)

export const createNode = (data: {
  question: string
  parentId?: string
  sessionId: string
  context?: string
}) => api.post<KnowledgeNode>('/chat', data)

export const deleteNode = (id: string) => api.delete(`/nodes/${id}`)

/**
 * 流式对话（SSE）。后端会推送 Agent 的完整执行过程：
 * status / round_start / token / round_end / action / observation / citations，
 * 最后以 done 事件返回落库后的节点。onEvent 用于实时渲染「思考 → 调用工具 → 观察结果」。
 */
export const streamChat = async (
  data: { question: string; parentId?: string; sessionId: string; context?: string },
  onEvent: (event: AgentEvent) => void,
): Promise<KnowledgeNode> => {
  const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '/api'
  const response = await fetch(`${baseUrl}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    throw new Error(`HTTP error ${response.status}`)
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const state: { node: KnowledgeNode | null; error: string | null } = {
    node: null,
    error: null,
  }

  const handlePayload = (payload: string) => {
    let event: AgentEvent
    try {
      event = JSON.parse(payload) as AgentEvent
    } catch {
      return
    }

    if (event.type === 'error') state.error = event.message
    if (event.type === 'done') state.node = event.node
    onEvent(event)
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // SSE 以空行分隔事件块；心跳为 ": ping" 注释行，会被下面的前缀判断过滤掉
    const chunks = buffer.split('\n\n')
    buffer = chunks.pop() ?? ''

    for (const chunk of chunks) {
      const payload = chunk
        .split('\n')
        .filter((line) => line.startsWith('data: '))
        .map((line) => line.slice(6))
        .join('')
      if (payload) handlePayload(payload)
    }
  }

  if (!state.node) throw new Error(state.error || 'Stream ended without receiving node data')
  return state.node
}
