import { ref, nextTick, type Ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useKnowledgeStore } from '../stores/knowledge'

export function useChat(chatListRef: Ref<HTMLElement | null>) {
  const store = useKnowledgeStore()
  const newQuestion = ref('')
  const pendingQuestion = ref('')

  const scrollToBottom = async () => {
    await nextTick()
    if (chatListRef.value) {
      chatListRef.value.scrollTop = chatListRef.value.scrollHeight
    }
  }

  const handleAsk = async (options: { context?: string; parentId?: string }) => {
    if (!newQuestion.value.trim()) return

    const question = newQuestion.value
    pendingQuestion.value = question
    newQuestion.value = ''

    try {
      await store.askQuestion(question, options.parentId, options.context)
      ElMessage.success('问题已回答！')
      await scrollToBottom()
    } catch (error: unknown) {
      console.error(error)
      if (error instanceof Error && 'code' in error && error.code === 'ECONNABORTED') {
        ElMessage.error('请求超时，本地模型生成较慢，请耐心等待或检查 Ollama 状态')
      } else {
        ElMessage.error('获取回答失败，请检查网络或后端服务')
      }
    } finally {
      pendingQuestion.value = ''
    }
  }

  return {
    newQuestion,
    pendingQuestion,
    handleAsk,
    scrollToBottom,
  }
}
