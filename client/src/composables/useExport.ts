import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useKnowledgeStore } from '../stores/knowledge'
import {
  exportKnowledgeAsXMind,
  exportKnowledgeAsMarkdownZip,
  triggerDownload,
} from '../utils/knowledgeExport'

export function useExport() {
  const store = useKnowledgeStore()
  const exportingXMind = ref(false)
  const exportingMarkdown = ref(false)
  const exportScope = ref<'all' | 'selected-path'>('all')
  const exportHighlightColor = ref('')
  const exportTargetNodeIds = ref<string[]>([])

  const buildNodeChain = (nodeId: string) => {
    const chain: string[] = []
    let cursor = store.nodes.find((n) => n._id === nodeId)
    while (cursor) {
      chain.unshift(cursor._id)
      const parentId = cursor.parentId
      if (!parentId) break
      cursor = store.nodes.find((n) => n._id === parentId)
    }
    return chain
  }

  const exportPathNodeIds = computed(() => {
    if (exportScope.value !== 'selected-path') return []
    const pathSet = new Set<string>()
    exportTargetNodeIds.value.forEach((nodeId) => {
      buildNodeChain(nodeId).forEach((id) => pathSet.add(id))
    })
    return Array.from(pathSet)
  })

  const getExportNodes = () => {
    if (exportScope.value === 'all') {
      return store.nodes
    }
    if (!exportTargetNodeIds.value.length || !exportPathNodeIds.value.length) {
      return null
    }
    const pathSet = new Set(exportPathNodeIds.value)
    return store.nodes.filter((node) => pathSet.has(node._id))
  }

  const getExportFileTime = () => {
    const d = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
  }

  const handleExportXMind = () => {
    const nodes = getExportNodes()
    if (!nodes || !nodes.length) {
      ElMessage.warning('暂无可导出的知识节点')
      return
    }
    exportingXMind.value = true
    try {
      const blob = exportKnowledgeAsXMind(nodes)
      triggerDownload(blob, `AI学习树-${getExportFileTime()}.xmind`)
      ElMessage.success('XMind 知识框架图已开始下载')
    } finally {
      exportingXMind.value = false
    }
  }

  const handleExportMarkdown = () => {
    const nodes = getExportNodes()
    if (!nodes || !nodes.length) {
      ElMessage.warning('暂无可导出的知识节点')
      return
    }
    exportingMarkdown.value = true
    try {
      const blob = exportKnowledgeAsMarkdownZip(nodes)
      triggerDownload(blob, `AI学习树-Markdown-${getExportFileTime()}.zip`)
      ElMessage.success('Markdown 目录包已开始下载')
    } finally {
      exportingMarkdown.value = false
    }
  }

  const setExportHighlight = (color: string) => {
    exportHighlightColor.value = color
  }

  const clearExportHighlight = () => {
    exportHighlightColor.value = ''
  }

  const addExportTarget = (nodeId: string) => {
    if (!exportTargetNodeIds.value.includes(nodeId)) {
      exportTargetNodeIds.value.push(nodeId)
    }
  }

  const removeExportTarget = (nodeId: string) => {
    exportTargetNodeIds.value = exportTargetNodeIds.value.filter((id) => id !== nodeId)
  }

  const clearExportTargets = () => {
    exportTargetNodeIds.value = []
  }

  const exportTargetNodes = computed(() => {
    return exportTargetNodeIds.value
      .map((id) => store.nodes.find((node) => node._id === id))
      .filter((node): node is NonNullable<typeof node> => Boolean(node))
  })

  return {
    exportingXMind,
    exportingMarkdown,
    exportScope,
    exportHighlightColor,
    exportTargetNodeIds,
    exportPathNodeIds,
    exportTargetNodes,
    handleExportXMind,
    handleExportMarkdown,
    setExportHighlight,
    clearExportHighlight,
    addExportTarget,
    removeExportTarget,
    clearExportTargets,
  }
}
