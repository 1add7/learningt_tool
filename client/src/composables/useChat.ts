import { ref, reactive, nextTick, type Ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useKnowledgeStore } from '../stores/knowledge'
import type { AgentEvent, Citation } from '../types'

/** 一次工具调用（action → observation）的执行记录 */
export interface AgentStep {
  id: string
  iteration: number
  tool: string
  args: Record<string, unknown>
  status: 'running' | 'done' | 'failed'
  content: string
}

/** Agent 一次完整回答的执行轨迹，供前端可视化「思考 → 调用工具 → 观察结果」 */
export interface AgentTraceState {
  active: boolean
  statusMessage: string
  thinkingText: string
  steps: AgentStep[]
  citations: Citation[]
  iterations: number
  usedAgent: boolean
  nodeId: string | null
}

const createEmptyTrace = (): AgentTraceState => ({
  active: false,
  statusMessage: '',
  thinkingText: '',
  steps: [],
  citations: [],
  iterations: 0,
  usedAgent: false,
  nodeId: null,
})

export function useChat(chatListRef: Ref<HTMLElement | null>) {
  const store = useKnowledgeStore()
  const newQuestion = ref('')
  const pendingQuestion = ref('')
  const streamingContent = ref('')
  const agentTrace = reactive<AgentTraceState>(createEmptyTrace())

  const scrollToBottom = async () => {
    await nextTick()
    if (chatListRef.value) {
      chatListRef.value.scrollTop = chatListRef.value.scrollHeight
    }
  }

  /** 流式过程中贴近底部时才自动滚动，避免打断用户向上翻阅 */
  const scrollIfNearBottom = () => {
    const el = chatListRef.value
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    if (nearBottom) el.scrollTop = el.scrollHeight
  }

  const resetAgentTrace = () => {
    Object.assign(agentTrace, createEmptyTrace())
  }

  /** 后端透传的错误可能是 LLM 原始响应体，这里尽量取出人类可读的那一句 */
  const describeError = (error: unknown) => {
    const raw = error instanceof Error ? error.message : String(error)
    const message = raw.match(/"message"\s*:\s*"([^"]+)"/)?.[1] ?? raw
    return message.length > 140 ? `${message.slice(0, 140)}…` : message
  }

  /**
   * 事件协议见后端 agentService.AgentEvent。
   * token 先进入当前轮的缓冲（streamingContent），
   * round_end 时再按 kind 决定它是「思考过程」还是「最终回答」。
   */
  const handleAgentEvent = (event: AgentEvent) => {
    switch (event.type) {
      case 'status':
        agentTrace.statusMessage = event.message
        break
      case 'round_start':
        agentTrace.statusMessage = ''
        break
      case 'token':
        streamingContent.value += event.content
        scrollIfNearBottom()
        break
      case 'round_end':
        if (event.kind === 'thinking') {
          if (streamingContent.value.trim()) {
            agentTrace.thinkingText += streamingContent.value
          }
          streamingContent.value = ''
        }
        break
      case 'action':
        agentTrace.steps.push({
          id: event.id,
          iteration: event.iteration,
          tool: event.tool,
          args: event.args,
          status: 'running',
          content: '',
        })
        break
      case 'observation': {
        const step = agentTrace.steps.find((item) => item.id === event.id)
        if (step) {
          step.status = event.ok ? 'done' : 'failed'
          step.content = event.content
        }
        break
      }
      case 'citations':
        agentTrace.citations = event.items
        break
      case 'done':
        agentTrace.iterations = event.iterations
        agentTrace.usedAgent = event.usedAgent
        // 记住轨迹归属的节点，回答完成后仍可在该节点下回看
        agentTrace.nodeId = event.node._id
        break
      case 'error':
        agentTrace.statusMessage = `执行失败：${event.message}`
        break
    }
  }

  const handleAsk = async (options: { context?: string; parentId?: string }) => {
    if (!newQuestion.value.trim()) return

    const question = newQuestion.value
    pendingQuestion.value = question
    newQuestion.value = ''
    streamingContent.value = ''
    resetAgentTrace()
    agentTrace.active = true

    try {
      await store.askQuestionStreaming(
        question,
        options.parentId,
        options.context,
        handleAgentEvent,
      )
      // Clear pending state BEFORE scrollToBottom so we scroll to the real ChatBubble
      pendingQuestion.value = ''
      streamingContent.value = ''
      await scrollToBottom()
    } catch (error: unknown) {
      console.error(error)
      ElMessage.error(describeError(error) || '获取回答失败，请检查网络或后端服务')
      pendingQuestion.value = ''
      streamingContent.value = ''
      resetAgentTrace()
    } finally {
      agentTrace.active = false
    }
  }

  return {
    newQuestion,
    pendingQuestion,
    streamingContent,
    agentTrace,
    handleAsk,
    scrollToBottom,
  }
}
