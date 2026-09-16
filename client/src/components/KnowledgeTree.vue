<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted, computed } from 'vue'
import * as echarts from 'echarts'
import type { KnowledgeNode } from '../types'
import { useKnowledgeStore } from '../stores/knowledge'
import { ElMessageBox, ElMessage } from 'element-plus'
import { Delete, RefreshRight, Share } from '@element-plus/icons-vue'
import { initKnowledgeTree } from '../utils/knowledgeTreeChart'

const props = defineProps<{
  data: KnowledgeNode[]
  /** ID of the node that will become parent of the next question — ghost child appears here */
  ghostParentId?: string | null
  /** Label shown on the ghost child (e.g. "平行追问" / "深入探究") */
  ghostModeLabel?: string
  exportPathNodeIds?: string[]
  exportPathColor?: string
}>()

const emit = defineEmits<{
  (e: 'node-click', node: KnowledgeNode): void
}>()

const store = useKnowledgeStore()
const chartContainer = ref<HTMLElement | null>(null)
let chartInstance: echarts.ECharts | null = null
const isDeleting = ref(false)

const getCssVar = (name: string) => {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

const getTheme = () => {
  return {
    primaryColor: getCssVar('--primary-color') || '#1890ff',
    accentColor: getCssVar('--accent-color') || '#40a9ff',
    shadowColor: getCssVar('--shadow-color') || 'rgba(24, 144, 255, 0.2)',
    borderColor: getCssVar('--border-color') || '#d9d9d9',
    hoverBorderColor: getCssVar('--hover-border-color') || '#40a9ff',
    chartLineColor: getCssVar('--chart-line-color') || '#bae7ff',
    textColor: getCssVar('--text-color') || '#333333',
    backgroundColor: getCssVar('--background-color') || '#ffffff',
    isDark: document.documentElement.getAttribute('data-theme') === 'black',
  }
}

const totalNodeCount = computed(() => store.nodes.length)
const selectedNode = computed(() => store.nodes.find((n) => n._id === store.selectedNodeId) || null)
const statusText = computed(() => {
  if (selectedNode.value) {
    return `当前聚焦：${selectedNode.value.question}`
  }
  if (props.exportPathNodeIds?.length) {
    return `已高亮 ${props.exportPathNodeIds.length} 个导出路径节点，可继续补全分支。`
  }
  return '点击节点切换问答链路，选中文本后可以作为上下文继续追问。'
})

const updateChart = () => {
  if (!chartContainer.value) return
  const theme = {
    ...getTheme(),
    exportPathNodeIds: props.exportPathNodeIds || [],
    exportPathColor: props.exportPathColor || '',
  }
  chartInstance = initKnowledgeTree(
    chartContainer.value,
    props.data,
    store.selectedNodeId,
    props.ghostParentId || null,
    props.ghostModeLabel || '',
    theme,
  )
  setupEvents()
}

const resetView = () => {
  updateChart()
}

const setupEvents = () => {
  if (!chartInstance) return
  chartInstance.off('click')

  chartInstance.on('click', (params: echarts.ECElementEvent) => {
    if (params.seriesType !== 'tree') {
      return
    }
    const data = params.data as
      | { originalData?: KnowledgeNode & { isVirtualRoot?: boolean }; value?: string }
      | null
      | undefined

    // Ignore clicks on the ghost preview node
    if (data?.value === '__ghost_preview__') return

    const rawNode = data?.originalData || store.nodes.find((n) => n._id === data?.value)
    if (!rawNode || !rawNode._id) {
      return
    }
    // 虚拟聚合根节点：不可点击恢复会话
    if ((rawNode as { isVirtualRoot?: boolean }).isVirtualRoot) {
      return
    }
    const matchedNode = store.nodes.find((n) => n._id === rawNode._id)
    if (matchedNode) {
      store.selectedNodeId = matchedNode._id
      emit('node-click', matchedNode)
    }
  })
}

const handleDeleteNode = async () => {
  if (!store.selectedNodeId) return

  const nodeToDelete = store.nodes.find((n) => n._id === store.selectedNodeId)
  if (!nodeToDelete) return

  if (!nodeToDelete.parentId) {
    ElMessage.warning('根节点不可删除')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定删除『${nodeToDelete.question}』及其所有子节点？此操作不可恢复。`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )

    isDeleting.value = true
    await store.deleteNode(nodeToDelete._id)
    store.selectedNodeId = null // Deselect after delete
  } catch (e) {
    if (e !== 'cancel') {
      console.error(e)
      ElMessage.error('删除失败')
    }
  } finally {
    isDeleting.value = false
  }
}

// Watch for data changes or selection changes to redraw
watch(
  () => [
    props.data,
    store.selectedNodeId,
    props.ghostParentId,
    props.ghostModeLabel,
    props.exportPathNodeIds,
    props.exportPathColor,
  ],
  () => {
    updateChart()
  },
  { deep: true },
)

// Resize handler
const handleResize = () => {
  chartInstance?.resize()
}

onMounted(() => {
  setTimeout(() => {
    updateChart()
  }, 100)

  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  chartInstance?.dispose()
})

defineExpose({ updateChart, resizeChart: handleResize, resetView })
</script>

<template>
  <div class="tree-wrapper">
    <div class="tree-panel-head">
      <span class="tree-panel-kicker">Knowledge Frame</span>
      <div class="tree-panel-title-row">
        <h3 class="tree-panel-title">知识脉络</h3>
        <span class="tree-panel-count">{{ totalNodeCount }} 节点</span>
      </div>
      <p class="tree-panel-subtitle">{{ statusText }}</p>
    </div>

    <div ref="chartContainer" class="chart-container"></div>

    <div v-if="!props.data.length" class="tree-empty">
      <el-icon :size="48" class="tree-empty-icon"><Share /></el-icon>
      <p class="tree-empty-title">知识树尚未建立</p>
      <p class="tree-empty-hint">
        在右侧开启对话，每一次提问都会成为这棵树上的一个节点 —— 你的知识图景会在这里自动生长。
      </p>
    </div>

    <div class="tree-panel-legend">
      <span class="legend-item">
        <i class="legend-dot current"></i>
        当前节点
      </span>
      <span class="legend-item">
        <i class="legend-dot preview"></i>
        预计挂载
      </span>
      <span class="legend-item">
        <i class="legend-dot path"></i>
        导出路径
      </span>
      <span class="legend-item interaction"> 拖拽平移 · 滚轮缩放 </span>
    </div>

    <div class="tree-controls">
      <div class="tree-controls-actions">
        <el-tooltip content="重置知识树视图" placement="left">
          <el-button class="tree-reset-btn" circle :icon="RefreshRight" @click="resetView" />
        </el-tooltip>
        <el-tooltip v-if="store.selectedNodeId" content="删除当前节点及子节点" placement="left">
          <el-button
            type="danger"
            class="tree-delete-btn"
            circle
            :icon="Delete"
            @click="handleDeleteNode"
            :loading="isDeleting"
            :disabled="!store.nodes.find((n) => n._id === store.selectedNodeId)?.parentId"
          />
        </el-tooltip>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tree-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: 22px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.3), rgba(255, 255, 255, 0) 24%),
    radial-gradient(circle at 14% 16%, rgba(47, 141, 255, 0.14), transparent 34%),
    radial-gradient(circle at 82% 82%, rgba(76, 175, 80, 0.12), transparent 32%),
    linear-gradient(180deg, rgba(248, 251, 255, 0.96), rgba(241, 246, 255, 0.92));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.45);
}

.tree-wrapper::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(148, 163, 184, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(148, 163, 184, 0.08) 1px, transparent 1px);
  background-size: 28px 28px;
  mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.42), transparent 78%);
  pointer-events: none;
}

.tree-wrapper::after {
  content: '';
  position: absolute;
  inset: 14px;
  border-radius: 18px;
  border: 1px solid rgba(163, 191, 255, 0.28);
  pointer-events: none;
}

.tree-panel-head {
  position: absolute;
  top: 18px;
  left: 18px;
  z-index: 4;
  max-width: min(340px, calc(100% - 170px));
  padding: 12px 14px;
  border-radius: 18px;
  border: 1px solid rgba(162, 190, 241, 0.32);
  background: rgba(255, 255, 255, 0.76);
  backdrop-filter: blur(14px);
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
  pointer-events: none;
}

.tree-panel-kicker {
  display: inline-flex;
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #5b84d6;
  font-weight: 700;
}

.tree-panel-title-row {
  margin-top: 4px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.tree-panel-title {
  margin: 0;
  font-size: 24px;
  line-height: 1.1;
  color: #16325c;
}

.tree-panel-count {
  flex-shrink: 0;
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(45, 125, 255, 0.1);
  color: #2456a6;
  font-size: 12px;
  font-weight: 700;
}

.tree-panel-subtitle {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.55;
  color: #4f6487;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.chart-container {
  width: 100%;
  height: 100%;
  min-height: 460px;
  cursor: grab;
}

.chart-container:active {
  cursor: grabbing;
}

.chart-container :deep(canvas) {
  cursor: inherit !important;
}

.tree-empty {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px 28px;
  text-align: center;
  pointer-events: none;
}

.tree-empty-icon {
  color: #3b82f6;
  opacity: 0.6;
}

.tree-empty-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #1f3b6d;
}

.tree-empty-hint {
  margin: 0;
  font-size: 13px;
  color: #4f6487;
  max-width: 340px;
  line-height: 1.65;
}

:global([data-theme='black']) .tree-empty-title {
  color: #d7e2f5;
}
:global([data-theme='black']) .tree-empty-hint {
  color: #9eacc2;
}
:global([data-theme='black']) .tree-empty-icon {
  color: #6aa2ff;
}

.tree-panel-legend {
  position: absolute;
  left: 18px;
  bottom: 18px;
  z-index: 4;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-width: calc(100% - 36px);
  pointer-events: none;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 10px;
  border-radius: 999px;
  border: 1px solid rgba(160, 181, 218, 0.34);
  background: rgba(255, 255, 255, 0.74);
  color: #50627f;
  font-size: 12px;
  backdrop-filter: blur(12px);
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.6);
}

.legend-dot.current {
  background: #1890ff;
}

.legend-dot.preview {
  background: #f59e0b;
}

.legend-dot.path {
  background: #3b82f6;
}

.legend-item.interaction {
  color: #35537e;
  background: rgba(227, 238, 255, 0.82);
}

.tree-controls {
  position: absolute;
  top: 18px;
  right: 18px;
  z-index: 5;
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
}

.tree-controls-actions {
  display: flex;
  gap: 10px;
}

.tree-reset-btn {
  width: 42px;
  height: 42px;
  border: 1px solid rgba(188, 206, 238, 0.86);
  background: rgba(255, 255, 255, 0.84);
  color: #33568c;
  box-shadow: 0 10px 22px rgba(44, 92, 172, 0.14);
}

.tree-delete-btn {
  width: 42px;
  height: 42px;
  border-width: 0;
  background: linear-gradient(135deg, #ef4444, #dc2626);
  box-shadow: 0 8px 22px rgba(239, 68, 68, 0.32);
}

.tree-delete-btn:hover {
  transform: translateY(-1px) scale(1.03);
}

.tree-reset-btn:hover {
  transform: translateY(-1px);
  background: rgba(255, 255, 255, 0.96);
  border-color: rgba(107, 149, 221, 0.9);
}

:global([data-theme='black']) .tree-wrapper {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0) 24%),
    radial-gradient(circle at 15% 18%, rgba(45, 125, 255, 0.18), transparent 34%),
    radial-gradient(circle at 82% 82%, rgba(74, 222, 128, 0.12), transparent 30%),
    linear-gradient(180deg, rgba(25, 28, 34, 0.98), rgba(20, 22, 27, 0.96));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

:global([data-theme='black']) .tree-wrapper::before {
  background-image:
    linear-gradient(rgba(84, 95, 115, 0.18) 1px, transparent 1px),
    linear-gradient(90deg, rgba(84, 95, 115, 0.18) 1px, transparent 1px);
}

:global([data-theme='black']) .tree-wrapper::after {
  border-color: rgba(66, 76, 94, 0.56);
}

:global([data-theme='black']) .tree-panel-head {
  border-color: rgba(57, 68, 87, 0.86);
  background: rgba(19, 22, 28, 0.76);
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.22);
}

:global([data-theme='black']) .tree-panel-kicker {
  color: #86aef8;
}

:global([data-theme='black']) .tree-panel-title {
  color: #eef4ff;
}

:global([data-theme='black']) .tree-panel-count {
  background: rgba(45, 125, 255, 0.18);
  color: #bfd7ff;
}

:global([data-theme='black']) .tree-panel-subtitle {
  color: #9eacc2;
}

:global([data-theme='black']) .legend-item {
  border-color: rgba(55, 65, 81, 0.92);
  background: rgba(20, 24, 30, 0.78);
  color: #abb7ca;
}

:global([data-theme='black']) .legend-item.interaction {
  background: rgba(21, 30, 43, 0.86);
  color: #bfd0ea;
}

:global([data-theme='black']) .tree-reset-btn {
  background: rgba(19, 24, 32, 0.86);
  border-color: rgba(58, 71, 92, 0.9);
  color: #d6e3f8;
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.22);
}

:global([data-theme='black']) .tree-reset-btn:hover {
  background: rgba(25, 31, 42, 0.96);
  border-color: rgba(84, 109, 151, 0.9);
}
</style>
