import { ref, computed, type Ref } from 'vue'
import { useKnowledgeStore } from '../stores/knowledge'
import type { ContextItem } from './useContext'

/**
 * 挂载模式 - 控制新问题挂载在知识树上的位置：
 * - followup（深入探究）：挂载到当前选中节点作为子节点，继续深挖当前话题
 * - parallel（平行追问）：挂载到当前选中节点的父节点，形成平行的新分支
 * - root：作为全新独立根节点，开启一条新的知识分支
 */
export type MountMode = 'followup' | 'parallel' | 'root'

export function useMountMode(selectedContexts: Ref<ContextItem[]>) {
  const store = useKnowledgeStore()
  const askMode = ref<MountMode>('followup')

  /** 最终用于创建节点的 parentId（undefined 即为新根节点） */
  const effectiveParentId = computed<string | undefined>(() => {
    if (askMode.value === 'root') return undefined

    const selected = store.selectedNodeId
    if (!selected) return undefined

    if (askMode.value === 'parallel') {
      // 平行追问：挂到当前节点的父节点（形成兄弟节点）
      const currentNode = store.nodes.find((n) => n._id === selected)
      return currentNode?.parentId || undefined
    }

    // followup（深入探究）：挂到当前选中节点
    return selected
  })

  const anchorTargetNode = computed(() => {
    const id = effectiveParentId.value
    if (!id) return null
    return store.nodes.find((node) => node._id === id) || null
  })

  return {
    askMode,
    effectiveParentId,
    // 兼容旧 API 名称
    anchorTargetNodeId: effectiveParentId,
    anchorTargetNode,
  }
}
