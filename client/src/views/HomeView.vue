<script setup lang="ts">
import { ref, onMounted, watch, computed, nextTick, onUnmounted } from 'vue'
import { useKnowledgeStore } from '../stores/knowledge'
import KnowledgeTree from '../components/KnowledgeTree.vue'
import ChatBubble from '../components/ChatBubble.vue'
import AgentTrace from '../components/AgentTrace.vue'
import type { KnowledgeNode } from '../types'
import { ElMessage } from 'element-plus'
import {
  Moon,
  Sunny,
  Share,
  Position,
  ChatLineRound,
  DataAnalysis,
  Download,
  Plus,
  Document,
  Files,
  Aim,
} from '@element-plus/icons-vue'
import { useTheme } from '../composables/useTheme'
import { useChat } from '../composables/useChat'
import { useExport } from '../composables/useExport'
import { useContext } from '../composables/useContext'
import { useMountMode } from '../composables/useMountMode'

const store = useKnowledgeStore()
const knowledgeTreeRef = ref<InstanceType<typeof KnowledgeTree> | null>(null)
const chatListRef = ref<HTMLElement | null>(null)
const contentContainerRef = ref<{ $el: HTMLElement } | null>(null)
const leftPaneRatio = ref(0.46)
const isResizing = ref(false)
const isStackedLayout = ref(false)
const hasCustomSplit = ref(false)

const SPLIT_STORAGE_KEY = 'learning-tree-left-pane-ratio'
const DEFAULT_LEFT_PANE_RATIO = 0.46
const EXPORT_LEFT_PANE_RATIO = 0.54
const MIN_LEFT_PANE_RATIO = 0.34
const MAX_LEFT_PANE_RATIO = 0.68
const STACK_LAYOUT_BREAKPOINT = 1180

const { isDark, toggleTheme } = useTheme()
const {
  newQuestion,
  pendingQuestion,
  streamingContent,
  agentTrace,
  handleAsk: askQuestion,
  scrollToBottom,
} = useChat(chatListRef)
const {
  exportingXMind,
  exportingMarkdown,
  exportingMarkdownFile,
  exportScope,
  exportHighlightColor,
  exportPathNodeIds,
  exportTargetNodes,
  handleExportXMind,
  handleExportMarkdown,
  handleExportMarkdownFile,
  setExportHighlight,
  clearExportHighlight,
  addExportTarget,
  removeExportTarget,
  clearExportTargets,
} = useExport()
const {
  selectedContexts,
  addContext,
  removeContext,
  clearAllContexts,
  handleDragStart,
  handleDrop,
  handleDragEnd,
  mergedContext,
} = useContext()
const { askMode, effectiveParentId, anchorTargetNodeId, anchorTargetNode } =
  useMountMode(selectedContexts)

const modeBarInlineStyle = computed(() =>
  isDark.value ? { background: '#1b1e24', borderColor: '#2a2f38' } : {},
)

const exportActionsInlineStyle = computed(() =>
  isDark.value ? { background: '#17191e', borderTopColor: '#252932' } : {},
)

const inputWrapperInlineStyle = computed(() =>
  isDark.value ? { backgroundColor: '#1b1e24', borderColor: '#2b313d' } : {},
)

const exportSelectingMode = computed(() => exportScope.value === 'selected-path')
const treePaneInlineStyle = computed(() => {
  if (isStackedLayout.value) return {}
  return {
    width: `${leftPaneRatio.value * 100}%`,
    flexBasis: `${leftPaneRatio.value * 100}%`,
  }
})

const chatPaneInlineStyle = computed(() => {
  if (isStackedLayout.value) return {}
  const ratio = 1 - leftPaneRatio.value
  return {
    width: `${ratio * 100}%`,
    flexBasis: `${ratio * 100}%`,
  }
})

const splitRatioLabel = computed(
  () => `${Math.round(leftPaneRatio.value * 100)} / ${Math.round((1 - leftPaneRatio.value) * 100)}`,
)

const clampRatio = (ratio: number) =>
  Math.min(MAX_LEFT_PANE_RATIO, Math.max(MIN_LEFT_PANE_RATIO, ratio))

const refreshTreeCanvas = () => {
  requestAnimationFrame(() => {
    knowledgeTreeRef.value?.resizeChart?.()
  })
}

const applySplitRatio = (ratio: number, markCustom = false, persist = true) => {
  leftPaneRatio.value = clampRatio(ratio)
  if (markCustom) {
    hasCustomSplit.value = true
  }
  if (persist) {
    localStorage.setItem(SPLIT_STORAGE_KEY, String(leftPaneRatio.value))
  }
  refreshTreeCanvas()
}

const getDefaultSplitRatio = () =>
  exportSelectingMode.value ? EXPORT_LEFT_PANE_RATIO : DEFAULT_LEFT_PANE_RATIO

const updateLayoutMode = () => {
  isStackedLayout.value = window.innerWidth <= STACK_LAYOUT_BREAKPOINT
  refreshTreeCanvas()
}

const handleResizerMove = (event: PointerEvent) => {
  const el = contentContainerRef.value?.$el as HTMLElement | undefined
  if (!isResizing.value || !el) return
  const rect = el.getBoundingClientRect()
  if (!rect.width) return
  const ratio = (event.clientX - rect.left) / rect.width
  applySplitRatio(ratio, true)
}

const stopResize = () => {
  if (!isResizing.value) return
  isResizing.value = false
  document.body.style.userSelect = ''
  document.body.style.cursor = ''
  window.removeEventListener('pointermove', handleResizerMove)
  window.removeEventListener('pointerup', stopResize)
  refreshTreeCanvas()
}

const startResize = (event: PointerEvent) => {
  if (isStackedLayout.value) return
  event.preventDefault()
  isResizing.value = true
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'col-resize'
  window.addEventListener('pointermove', handleResizerMove)
  window.addEventListener('pointerup', stopResize)
}

const resetSplitRatio = () => {
  hasCustomSplit.value = false
  applySplitRatio(getDefaultSplitRatio())
}

const handleResizerKeydown = (event: KeyboardEvent) => {
  if (isStackedLayout.value) return
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    applySplitRatio(leftPaneRatio.value - 0.02, true)
  }
  if (event.key === 'ArrowRight') {
    event.preventDefault()
    applySplitRatio(leftPaneRatio.value + 0.02, true)
  }
  if (event.key === 'Home') {
    event.preventDefault()
    applySplitRatio(MIN_LEFT_PANE_RATIO, true)
  }
  if (event.key === 'End') {
    event.preventDefault()
    applySplitRatio(MAX_LEFT_PANE_RATIO, true)
  }
}

onMounted(() => {
  const savedRatio = Number(localStorage.getItem(SPLIT_STORAGE_KEY))
  if (Number.isFinite(savedRatio) && savedRatio > 0) {
    leftPaneRatio.value = clampRatio(savedRatio)
    hasCustomSplit.value = true
  } else {
    leftPaneRatio.value = getDefaultSplitRatio()
  }
  updateLayoutMode()
  window.addEventListener('resize', updateLayoutMode)
  store.fetchNodes()
})

onUnmounted(() => {
  window.removeEventListener('resize', updateLayoutMode)
  stopResize()
  chatScrollObserver?.disconnect()
})

// ── Scroll-sync: tree highlights whichever chat bubble is most visible ──
let chatScrollObserver: IntersectionObserver | null = null
let scrollSyncDebounce: ReturnType<typeof setTimeout> | null = null

const setupChatScrollSync = () => {
  chatScrollObserver?.disconnect()
  if (!chatListRef.value) return

  chatScrollObserver = new IntersectionObserver(
    (entries) => {
      // Don't disrupt the user while they are composing a message
      if (newQuestion.value.trim()) return

      let best: { nodeId: string; ratio: number } | null = null
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const nodeId = (entry.target as HTMLElement).dataset.nodeId
          if (nodeId && entry.intersectionRatio > (best?.ratio ?? 0)) {
            best = { nodeId, ratio: entry.intersectionRatio }
          }
        }
      }
      if (!best) return
      const nodeId = best.nodeId
      if (nodeId === store.selectedNodeId) return

      // Debounce to avoid spam while fast-scrolling
      if (scrollSyncDebounce) clearTimeout(scrollSyncDebounce)
      scrollSyncDebounce = setTimeout(() => {
        if (nodeId !== store.selectedNodeId) {
          store.selectedNodeId = nodeId
        }
      }, 250)
    },
    {
      root: chatListRef.value,
      threshold: [0.3, 0.6, 1.0],
    },
  )

  // Observe each bubble; called after history renders
  nextTick(() => {
    const bubbles = chatListRef.value?.querySelectorAll<HTMLElement>(
      '.chat-bubble-container[data-node-id]',
    )
    bubbles?.forEach((el) => chatScrollObserver?.observe(el))
  })
}

// Re-setup observer whenever the chat history changes (new nodes added)
watch(
  () => store.currentChatHistory.map((n) => n._id).join(','),
  () => {
    nextTick(setupChatScrollSync)
  },
)

watch(
  () => store.currentChatHistory.length,
  () => {
    scrollToBottom()
  },
)

watch(
  () => exportScope.value,
  async () => {
    await nextTick()
    knowledgeTreeRef.value?.updateChart()
  },
)

watch(exportSelectingMode, (enabled) => {
  if (hasCustomSplit.value) return
  applySplitRatio(enabled ? EXPORT_LEFT_PANE_RATIO : DEFAULT_LEFT_PANE_RATIO, false, false)
})

// 当没有选中节点时，退回 followup 模式
watch(
  () => store.selectedNodeId,
  (id) => {
    if (!id) askMode.value = 'followup'
  },
)

const handleNodeClick = async (node: KnowledgeNode) => {
  if (exportScope.value === 'selected-path') {
    addExportTarget(node._id)
    ElMessage.success(`已加入导出终点`)
  }
  await store.restoreSession(node._id)
  scrollToBottom()
}

/** 从聊天气泡点击定位到树节点 */
const handleBubbleFocus = async (nodeId: string) => {
  if (nodeId === store.selectedNodeId) return
  await store.restoreSession(nodeId)
  // Don't auto-scroll — let user stay at their position in chat
}

/** 当前模式的幽灵节点标签 */
const ghostModeLabel = computed(() => {
  if (!store.selectedNodeId) return ''
  return askMode.value === 'parallel' ? '平行追问' : '深入探究'
})

const handleSelectText = (payload: { text: string; sourceNodeId: string }) => {
  addContext(payload.text, payload.sourceNodeId)
}

const onSubmit = async () => {
  await askQuestion({
    context: mergedContext.value,
    parentId: anchorTargetNodeId.value || undefined,
  })
}

const generateTest = () => {
  store.generateTestTree()
  ElMessage.success('已生成 10 级测试数据')
}

const startNewTopic = () => {
  store.selectedNodeId = null
  store.currentChatHistory = []
  clearAllContexts()
  askMode.value = 'followup'
  ElMessage.info('已切换到新话题，下一次提问将成为新的知识根节点')
}

/** 输入框占位符随当前挂载目标动态变化 */
const inputPlaceholder = computed(() => {
  if (store.loading) return 'AI 正在思考中...'
  if (!anchorTargetNode.value) return '输入您的问题，开启一个全新知识分支...'
  const q = anchorTargetNode.value.question
  const preview = q.slice(0, 20) + (q.length > 20 ? '…' : '')
  if (askMode.value === 'parallel') return `平行追问「${preview}」...`
  return `深入探究「${preview}」...`
})

/** 挂载位置文案 */
const mountLabel = computed(() => {
  if (!anchorTargetNode.value) return '将作为新的知识根节点'
  const q = anchorTargetNode.value.question
  const preview = q.slice(0, 18) + (q.length > 18 ? '…' : '')
  if (askMode.value === 'parallel') return `平行于「${preview}」`
  return `深入「${preview}」`
})
</script>

<template>
  <div class="common-layout">
    <el-container class="full-height">
      <el-header class="header">
        <div class="logo">
          <span class="logo-icon-wrap">
            <el-icon class="logo-icon">
              <Share />
            </el-icon>
          </span>
          <span class="logo-text">AI 学习树</span>
          <span class="logo-tag">把每一次提问，沉淀为知识</span>
        </div>
        <div class="header-controls">
          <el-button :icon="Plus" size="small" plain @click="startNewTopic" class="mr-2"
            >新话题</el-button
          >
          <el-tooltip content="生成 10 级测试数据" placement="bottom">
            <el-button
              @click="generateTest"
              circle
              size="small"
              :icon="DataAnalysis"
              class="mr-2"
            />
          </el-tooltip>
          <div class="theme-switch">
            <el-switch
              v-model="isDark"
              inline-prompt
              :active-icon="Moon"
              :inactive-icon="Sunny"
              @change="toggleTheme"
            />
          </div>
        </div>
      </el-header>

      <el-container
        ref="contentContainerRef"
        class="content-container"
        :class="{
          'is-stacked': isStackedLayout,
          'is-resizing': isResizing,
          'export-selecting': exportSelectingMode,
        }"
      >
        <el-aside class="tree-aside" :style="treePaneInlineStyle">
          <div class="tree-panel">
            <KnowledgeTree
              ref="knowledgeTreeRef"
              :data="store.treeData"
              :ghost-parent-id="effectiveParentId"
              :ghost-mode-label="ghostModeLabel"
              :export-path-node-ids="exportPathNodeIds"
              :export-path-color="exportHighlightColor"
              @node-click="handleNodeClick"
            />
          </div>
          <div class="tree-export-actions" :style="exportActionsInlineStyle">
            <div class="export-toolbar">
              <el-popover
                placement="top"
                :width="320"
                trigger="click"
                popper-class="export-popover"
              >
                <template #reference>
                  <el-button type="primary" plain :icon="Download" class="export-trigger">
                    导出知识框架
                  </el-button>
                </template>
                <div class="export-popover-body">
                  <div class="export-popover-title">选择导出方式</div>
                  <div class="export-scope-bar">
                    <span class="export-scope-title">范围</span>
                    <el-radio-group v-model="exportScope" size="small">
                      <el-radio-button label="all">全部</el-radio-button>
                      <el-radio-button label="selected-path">选中路径</el-radio-button>
                    </el-radio-group>
                  </div>
                  <div v-if="exportScope === 'selected-path'" class="export-path-tip">
                    {{
                      exportTargetNodes.length
                        ? `已选 ${exportTargetNodes.length} 个终点，导出将合并各终点到根节点的路径`
                        : '点击知识树中的节点添加为导出终点（可多选）'
                    }}
                  </div>
                  <div
                    v-if="exportScope === 'selected-path' && exportTargetNodes.length"
                    class="export-target-list"
                  >
                    <span
                      v-for="node in exportTargetNodes"
                      :key="node._id"
                      class="export-target-item"
                    >
                      <span class="export-target-text">{{ node.question }}</span>
                      <button
                        class="export-target-remove"
                        type="button"
                        @click="removeExportTarget(node._id)"
                      >
                        ×
                      </button>
                    </span>
                  </div>
                  <div
                    v-if="exportScope === 'selected-path' && exportTargetNodes.length"
                    class="export-target-actions"
                  >
                    <el-button size="small" text type="danger" @click="clearExportTargets"
                      >清空终点</el-button
                    >
                  </div>
                  <div class="export-button-grid">
                    <el-button
                      :icon="Document"
                      :loading="exportingMarkdownFile"
                      @click="handleExportMarkdownFile"
                      @mouseenter="setExportHighlight('#0ea5e9')"
                      @mouseleave="clearExportHighlight"
                    >
                      单文件 Markdown
                    </el-button>
                    <el-button
                      :icon="Files"
                      :loading="exportingMarkdown"
                      @click="handleExportMarkdown"
                      @mouseenter="setExportHighlight('#67c23a')"
                      @mouseleave="clearExportHighlight"
                    >
                      Markdown 目录包
                    </el-button>
                    <el-button
                      :icon="Share"
                      :loading="exportingXMind"
                      @click="handleExportXMind"
                      @mouseenter="setExportHighlight('#2d7dff')"
                      @mouseleave="clearExportHighlight"
                    >
                      XMind 文件
                    </el-button>
                  </div>
                  <p class="export-popover-hint">
                    · 单文件 MD：层级标题展开，适合作为学习笔记快速阅读<br />
                    · 目录包：每个节点一个 README.md，便于在 Obsidian/Notion 等导入<br />
                    · XMind：作为思维导图打开
                  </p>
                </div>
              </el-popover>
            </div>
          </div>
        </el-aside>

        <div
          v-if="!isStackedLayout"
          class="panel-resizer"
          :class="{ active: isResizing }"
          role="separator"
          aria-orientation="vertical"
          tabindex="0"
          @pointerdown="startResize"
          @dblclick="resetSplitRatio"
          @keydown="handleResizerKeydown"
        >
          <span class="panel-resizer-badge">{{ splitRatioLabel }}</span>
          <span class="panel-resizer-dots"> <i></i><i></i><i></i> </span>
        </div>

        <el-main class="chat-main" :style="chatPaneInlineStyle">
          <div class="chat-list" ref="chatListRef">
            <div
              v-if="!store.currentChatHistory.length && !pendingQuestion"
              class="welcome-placeholder"
            >
              <div class="welcome-content">
                <el-icon :size="64" class="welcome-icon">
                  <ChatLineRound />
                </el-icon>
                <h2>开启一段新的知识探索</h2>
                <p class="welcome-tip">
                  在下方输入你想探究的问题。AI 的每一次回答都会成为知识树上的一个节点 ——
                  你可以追问、分支、整理，最终导出为 Markdown 或 XMind 笔记。
                </p>
                <div class="welcome-hints">
                  <span class="welcome-chip">📌 选中回答中任意片段，可以"作为上下文"继续追问</span>
                  <span class="welcome-chip"
                    >🌿 点击知识树上的任一节点，回到那条思路上继续展开</span
                  >
                  <span class="welcome-chip">📤 随时把整棵知识树导出为可读的笔记文件</span>
                </div>
              </div>
            </div>

            <div v-else class="chat-bubbles">
              <ChatBubble
                v-for="(node, idx) in store.currentChatHistory"
                :key="node._id"
                :node="node"
                :is-tail="idx === store.currentChatHistory.length - 1"
                :is-selected="node._id === store.selectedNodeId"
                :data-node-id="node._id"
                @select-text="handleSelectText"
                @node-focus="handleBubbleFocus"
              />
              <!-- 回答完成后仍可回看的 Agent 执行轨迹 -->
              <AgentTrace
                v-if="
                  !pendingQuestion &&
                  agentTrace.nodeId &&
                  agentTrace.nodeId === store.selectedNodeId
                "
                class="trace-after-bubble"
                :state="agentTrace"
                @focus-node="handleBubbleFocus"
              />
              <!-- 待处理：用户消息立即显示，AI 回答流式呈现 -->
              <div v-if="pendingQuestion" class="pending-exchange">
                <div class="message-row user-row">
                  <div class="message-content user-content">{{ pendingQuestion }}</div>
                </div>
                <AgentTrace
                  v-if="
                    agentTrace.statusMessage ||
                    agentTrace.steps.length ||
                    agentTrace.citations.length
                  "
                  :state="agentTrace"
                  live
                  @focus-node="handleBubbleFocus"
                />
                <div class="message-row ai-row">
                  <div class="message-content-wrapper">
                    <div class="message-content ai-content streaming-bubble">
                      <template v-if="streamingContent">
                        <span class="streaming-text">{{ streamingContent }}</span
                        ><span class="stream-cursor"></span>
                      </template>
                      <div v-else class="typing-indicator">
                        <span></span><span></span><span></span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="input-area">
            <!-- 挂载位置 + 平行追问/深入探究模式切换 -->
            <div class="mode-bar" :style="modeBarInlineStyle">
              <div class="mount-target">
                <el-icon class="mount-target-icon"><Aim /></el-icon>
                <span class="mount-target-text">{{ mountLabel }}</span>
              </div>
              <div class="ask-mode-toggle" :class="{ 'is-disabled': !store.selectedNodeId }">
                <button
                  class="mode-btn"
                  :class="{ active: askMode === 'parallel' }"
                  type="button"
                  @click="askMode = 'parallel'"
                >
                  <svg class="mode-icon" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M2 4h5v2H2V4zm7 0h5v2H9V4zM2 10h5v2H2v-2zm7 0h5v2H9v-2z" />
                  </svg>
                  平行追问
                </button>
                <button
                  class="mode-btn"
                  :class="{ active: askMode === 'followup' }"
                  type="button"
                  @click="askMode = 'followup'"
                >
                  <svg class="mode-icon" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 2v9.17l-3.59-3.58L3 9l5 5 5-5-1.41-1.41L8 11.17V2H8z" />
                  </svg>
                  深入探究
                </button>
              </div>
            </div>

            <div v-if="selectedContexts.length" class="context-preview">
              <div class="context-head">
                <span class="context-title">已选中上下文（{{ selectedContexts.length }}）</span>
                <el-button text type="danger" @click="clearAllContexts">清空</el-button>
              </div>
              <div class="context-list">
                <div
                  v-for="(ctx, index) in selectedContexts"
                  :key="ctx.id"
                  class="context-item"
                  draggable="true"
                  @dragstart="handleDragStart(index)"
                  @dragover.prevent
                  @drop="handleDrop(index)"
                  @dragend="handleDragEnd"
                >
                  <span class="context-index">{{ index + 1 }}</span>
                  <span class="context-content">{{ ctx.text }}</span>
                  <el-button text type="danger" class="context-close" @click="removeContext(index)"
                    >移除</el-button
                  >
                </div>
              </div>
            </div>

            <div class="input-wrapper" :style="inputWrapperInlineStyle">
              <el-input
                v-model="newQuestion"
                type="textarea"
                :rows="2"
                :autosize="{ minRows: 2, maxRows: 6 }"
                :placeholder="inputPlaceholder"
                class="chat-input"
                @keydown.enter.exact.prevent="onSubmit"
                :disabled="store.loading"
              />
              <div class="input-toolbar">
                <div class="toolbar-actions">
                  <el-tooltip content="开启新话题" placement="top">
                    <button class="toolbar-icon-btn" type="button" @click="startNewTopic">
                      <el-icon><Plus /></el-icon>
                    </button>
                  </el-tooltip>
                  <el-tooltip content="清空上下文" placement="top">
                    <button
                      class="toolbar-icon-btn"
                      :class="{ 'is-active': selectedContexts.length > 0 }"
                      type="button"
                      @click="clearAllContexts"
                    >
                      <el-icon><Aim /></el-icon>
                    </button>
                  </el-tooltip>
                  <el-tooltip content="切换为新分支话题" placement="top">
                    <button class="toolbar-icon-btn" type="button" @click="startNewTopic">
                      <el-icon><Share /></el-icon>
                    </button>
                  </el-tooltip>
                </div>
                <div class="toolbar-right">
                  <span class="send-hint">Enter 发送</span>
                  <el-button
                    @click="onSubmit"
                    :loading="store.loading"
                    type="primary"
                    round
                    class="send-btn"
                    :disabled="!newQuestion.trim() || store.loading"
                  >
                    <el-icon><Position /></el-icon>
                    发送
                  </el-button>
                </div>
              </div>
            </div>
          </div>
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<style scoped>
.full-height {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-color, #dcdfe6);
  padding: 0 20px;
  background-color: var(--bg-color, #fff);
  color: var(--text-color, #333);
}

.logo {
  font-size: 20px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 10px;
  color: #1f2937;
}

.logo-icon-wrap {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--primary-color, #4caf50), #2f8dff);
  box-shadow: 0 6px 18px rgba(47, 141, 255, 0.28);
}

.logo-icon {
  color: #fff;
  font-size: 18px;
}

.logo-text {
  letter-spacing: 0.5px;
}

.header-controls {
  display: flex;
  align-items: center;
}

.theme-switch {
  display: flex;
  align-items: center;
}

.mr-2 {
  margin-right: 8px;
}

.content-container {
  flex: 1;
  overflow: hidden;
  display: flex;
  position: relative;
  min-height: 0;
  gap: 0;
}

.content-container.is-resizing,
.content-container.is-resizing * {
  user-select: none;
}

.tree-aside {
  border-right: 1px solid var(--border-color, #dcdfe6);
  background: var(--tree-panel-bg, linear-gradient(180deg, #f8fbff 0%, #f3f7ff 100%));
  display: flex;
  flex-direction: column;
  width: 43%;
  flex-basis: 43%;
  flex-shrink: 0;
  min-height: 0;
  min-width: 360px;
}

.tree-panel {
  flex: 1;
  min-height: 0;
}

.panel-resizer {
  position: relative;
  flex: 0 0 18px;
  min-width: 18px;
  cursor: col-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, rgba(227, 235, 249, 0.95), rgba(241, 245, 252, 0.85));
  border-left: 1px solid rgba(209, 220, 240, 0.9);
  border-right: 1px solid rgba(209, 220, 240, 0.9);
  touch-action: none;
  z-index: 3;
}

.panel-resizer::before {
  content: '';
  position: absolute;
  top: 20px;
  bottom: 20px;
  left: 50%;
  width: 2px;
  transform: translateX(-50%);
  border-radius: 999px;
  background: linear-gradient(
    180deg,
    rgba(100, 116, 139, 0.14),
    rgba(45, 125, 255, 0.42),
    rgba(100, 116, 139, 0.14)
  );
}

.panel-resizer.active::before,
.panel-resizer:hover::before,
.panel-resizer:focus-visible::before {
  background: linear-gradient(
    180deg,
    rgba(45, 125, 255, 0.18),
    rgba(45, 125, 255, 0.72),
    rgba(45, 125, 255, 0.18)
  );
}

.panel-resizer:focus-visible {
  outline: none;
  box-shadow: inset 0 0 0 2px rgba(45, 125, 255, 0.18);
}

.panel-resizer-badge {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 7px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(195, 210, 236, 0.9);
  color: #466188;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.panel-resizer-dots {
  position: relative;
  display: inline-grid;
  gap: 5px;
  z-index: 1;
}

.panel-resizer-dots i {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #6d88ae;
  box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.62);
}

.tree-export-actions {
  display: grid;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid #dde6f5;
  background: rgba(255, 255, 255, 0.9);
}

.tree-export-actions .el-button {
  width: 100%;
}

.export-scope-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.export-scope-title {
  font-size: 12px;
  color: #64748b;
  flex-shrink: 0;
}

.export-path-tip {
  font-size: 12px;
  color: #475569;
  border: 1px dashed #bcd0f5;
  border-radius: 8px;
  padding: 6px 8px;
  background: #f4f8ff;
}

.export-target-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.export-target-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.export-target-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  padding: 3px 8px;
  border-radius: 14px;
  border: 1px solid #c8daf7;
  background: #eef5ff;
}

.export-target-text {
  max-width: 150px;
  font-size: 12px;
  color: #334155;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.export-target-remove {
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 50%;
  background: #d6e5ff;
  color: #1d4ed8;
  cursor: pointer;
  line-height: 16px;
  padding: 0;
}

.chat-main {
  padding: 0;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-color, #fff);
  position: relative;
  width: 57%;
  flex-basis: 57%;
  flex-shrink: 0;
  min-width: 0;
}

.chat-list {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  padding-bottom: 180px;
  scroll-behavior: smooth;
}

.chat-bubbles {
  max-width: 800px;
  margin: 0 auto;
}

.welcome-placeholder {
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #909399;
}

.welcome-content {
  text-align: center;
}

.welcome-icon {
  margin-bottom: 20px;
  color: var(--primary-color, #4caf50);
  opacity: 0.5;
}

.input-area {
  position: absolute;
  bottom: 16px;
  left: 0;
  right: 0;
  padding: 12px 20px;
  background: transparent;
  z-index: 10;
}

.input-wrapper {
  max-width: 800px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  background-color: #f4f4f5;
  padding: 12px 16px 10px;
  border-radius: 18px;
  border: 1px solid transparent;
  transition:
    border-color 0.3s,
    box-shadow 0.3s;
}

.input-wrapper:focus-within {
  border-color: var(--primary-color, #4caf50);
  background-color: #fff;
  box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.1);
}

.chat-input :deep(.el-textarea__inner) {
  box-shadow: none;
  background-color: transparent;
  border: none;
  padding: 4px 0;
  resize: none;
  min-height: 52px;
  line-height: 24px;
}

.chat-input :deep(.el-textarea__inner::placeholder) {
  line-height: 24px;
}

.send-btn {
  flex-shrink: 0;
  height: 34px;
  padding: 0 14px;
  font-size: 13px;
  gap: 4px;
}

.mode-bar {
  max-width: 800px;
  margin: 0 auto 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 12px;
  border: 1px solid #dfe8f7;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
}

.mount-target {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  overflow: hidden;
}

.mount-target-icon {
  color: var(--primary-color, #4caf50);
  flex-shrink: 0;
  font-size: 13px;
}

.mount-target-text {
  font-size: 12px;
  color: #475569;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.input-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 2px 2px;
  border-top: 1px solid rgba(0, 0, 0, 0.07);
  margin-top: 6px;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.toolbar-icon-btn {
  width: 30px;
  height: 30px;
  border: none;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  transition:
    background-color 0.2s,
    color 0.2s;
  padding: 0;
}

.toolbar-icon-btn:hover {
  background: rgba(45, 125, 255, 0.08);
  color: #2d7dff;
}

.toolbar-icon-btn.is-active {
  color: #2d7dff;
  background: rgba(45, 125, 255, 0.1);
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.send-hint {
  font-size: 11px;
  color: #c0c8d4;
  user-select: none;
}

.mode-title {
  font-size: 12px;
  color: #64748b;
}

.anchor-preview {
  max-width: 800px;
  margin: 0 auto 8px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid #d5deec;
  background: #f6f8fc;
}

.anchor-preview.active {
  border-color: #7ca8ff;
  background: #edf3ff;
  box-shadow: 0 0 0 2px rgba(45, 125, 255, 0.12);
}

.anchor-preview-label {
  font-size: 12px;
  color: #64748b;
  flex-shrink: 0;
}

.anchor-preview-value {
  font-size: 13px;
  color: #334155;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.context-preview {
  max-width: 800px;
  margin: 0 auto 8px;
  display: grid;
  gap: 8px;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid #e6edf7;
  border-radius: 14px;
  padding: 10px 12px;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.05);
}

.context-head {
  width: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.context-head-left {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ask-mode-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 10px;
  flex-shrink: 0;
  transition: opacity 0.2s;
}

.ask-mode-toggle.is-disabled {
  opacity: 0.4;
  pointer-events: none;
}

.mode-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: #64748b;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition:
    background 0.18s,
    color 0.18s,
    box-shadow 0.18s;
  white-space: nowrap;
  line-height: 1;
}

.mode-btn:hover {
  background: rgba(45, 125, 255, 0.08);
  color: #2d7dff;
}

.mode-btn.active {
  background: #ffffff;
  color: #1d4ed8;
  font-weight: 700;
  box-shadow:
    0 1px 4px rgba(0, 0, 0, 0.12),
    0 0 0 1px rgba(45, 125, 255, 0.2);
}

/* 平行追问 active: 绿色系 */
.mode-btn:first-child.active {
  color: #16a34a;
  box-shadow:
    0 1px 4px rgba(0, 0, 0, 0.1),
    0 0 0 1px rgba(34, 197, 94, 0.25);
}

.mode-icon {
  width: 13px;
  height: 13px;
  flex-shrink: 0;
}

.context-title {
  font-size: 12px;
  color: #6b7280;
}

.context-list {
  display: grid;
  gap: 6px;
}

.context-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid #d8e2f2;
  border-radius: 10px;
  background: #f8fbff;
  cursor: grab;
  transition:
    border-color 0.2s,
    background-color 0.2s;
}

.context-item:active {
  cursor: grabbing;
}

.context-item:hover {
  border-color: #9ec5ff;
  background: #eef6ff;
}

.context-index {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: #1d4ed8;
  background: #dbeafe;
  flex-shrink: 0;
}

.context-content {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: #374151;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.context-close {
  padding: 0 4px;
}

.context-merged {
  border-radius: 10px;
  background: #f3f7ff;
  border: 1px dashed #c9d8f3;
  padding: 8px 10px;
}

.merged-label {
  display: inline-block;
  font-size: 11px;
  color: #64748b;
  margin-bottom: 4px;
}

.context-merged p {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  color: #334155;
  white-space: pre-wrap;
}

:global([data-theme='black']) .tree-aside {
  --tree-panel-bg: linear-gradient(180deg, #1e1f22 0%, #17181b 100%);
}

:global([data-theme='black']) .tree-export-actions {
  border-top-color: #262a31;
  background: #181a1f;
}

:global([data-theme='black']) .tree-export-actions :global(.el-radio-button__inner) {
  background: #1f2229;
  color: #b8c1ce;
  border-color: #323843;
}

:global([data-theme='black'])
  .tree-export-actions
  :global(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
  background: #315d9f;
  border-color: #315d9f;
  color: #ffffff;
  box-shadow: -1px 0 0 0 #315d9f;
}

:global([data-theme='black']) .tree-export-actions :global(.el-radio-button__inner:hover) {
  color: #d7deea;
}

:global([data-theme='black']) .tree-export-actions :global(.el-button.is-plain) {
  background: #1f232a;
  border-color: #363c48;
  color: #c6cfdb;
}

:global([data-theme='black']) .tree-export-actions :global(.el-button.is-plain:hover) {
  background: #252b34;
  border-color: #4a5363;
  color: #e1e8f3;
}

:global([data-theme='black']) .export-scope-title {
  color: #9aa1ad;
}

:global([data-theme='black']) .export-path-tip {
  color: #b8c1ce;
  border-color: #38445b;
  background: #1c212b;
}

:global([data-theme='black']) .export-target-item {
  border-color: #36445c;
  background: #1d2430;
}

:global([data-theme='black']) .export-target-text {
  color: #d5dde8;
}

:global([data-theme='black']) .export-target-remove {
  background: #2c3a50;
  color: #cde1ff;
}

:global([data-theme='black']) .context-preview {
  background: #1d1f24;
  border-color: #2c3038;
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.2);
}

:global([data-theme='black']) .mode-bar {
  background: #1d2026;
  border-color: #2d323c;
}

:global([data-theme='black']) .ask-mode-toggle {
  background: rgba(255, 255, 255, 0.04);
}

:global([data-theme='black']) .mode-btn {
  color: #6b7785;
}

:global([data-theme='black']) .mode-btn:hover {
  background: rgba(86, 152, 255, 0.1);
  color: #6ea8fe;
}

:global([data-theme='black']) .mode-btn.active {
  background: #1e2535;
  color: #93c5fd;
  box-shadow:
    0 1px 4px rgba(0, 0, 0, 0.3),
    0 0 0 1px rgba(99, 168, 255, 0.25);
}

:global([data-theme='black']) .mode-btn:first-child.active {
  color: #4ade80;
  box-shadow:
    0 1px 4px rgba(0, 0, 0, 0.3),
    0 0 0 1px rgba(74, 222, 128, 0.25);
}

:global([data-theme='black']) .mount-target-icon {
  color: #6ea8fe;
}

:global([data-theme='black']) .mount-target-text {
  color: #9aa1ad;
}

:global([data-theme='black']) .input-toolbar {
  border-top-color: rgba(255, 255, 255, 0.07);
}

:global([data-theme='black']) .toolbar-icon-btn {
  color: #5b6b7c;
}

:global([data-theme='black']) .toolbar-icon-btn:hover {
  background: rgba(86, 152, 255, 0.1);
  color: #6ea8fe;
}

:global([data-theme='black']) .toolbar-icon-btn.is-active {
  color: #6ea8fe;
  background: rgba(86, 152, 255, 0.12);
}

:global([data-theme='black']) .send-hint {
  color: #3e4d5c;
}

:global([data-theme='black']) .anchor-preview {
  background: #1e2229;
  border-color: #303744;
}

:global([data-theme='black']) .anchor-preview.active {
  background: #1b2330;
  border-color: #4d6b97;
  box-shadow: 0 0 0 2px rgba(77, 107, 151, 0.18);
}

:global([data-theme='black']) .anchor-preview-label {
  color: #9aa1ad;
}

:global([data-theme='black']) .anchor-preview-value {
  color: #d4d9e2;
}

:global([data-theme='black']) .context-title {
  color: #9aa1ad;
}

:global([data-theme='black']) .context-item {
  background: #1f2228;
  border-color: #31353f;
}

:global([data-theme='black']) .context-item:hover {
  background: #242831;
  border-color: #3d4552;
}

:global([data-theme='black']) .context-content {
  color: #d5d9e0;
}

:global([data-theme='black']) .context-index {
  color: #8ca7cc;
  background: #273243;
}

:global([data-theme='black']) .context-merged {
  background: #1b1f25;
  border-color: #313844;
}

:global([data-theme='black']) .context-merged p {
  color: #c3cad4;
}

:global([data-theme='black']) .input-wrapper {
  background-color: #1d2026;
  border-color: #2f3540;
  box-shadow: none;
}

:global([data-theme='black']) .input-wrapper:focus-within {
  background-color: #1b1f26;
  border-color: #476391;
  box-shadow: 0 0 0 2px rgba(71, 99, 145, 0.18);
}
:global([data-theme='black']) .chat-input :deep(.el-textarea__inner) {
  background-color: #1d2026 !important;
  border: none !important;
  box-shadow: none !important;
  color: #d6dde8;
}

:global([data-theme='black']) .chat-input :deep(.el-textarea__inner::placeholder) {
  color: #7f8a9b;
}

:global([data-theme='black']) .chat-input :deep(.el-textarea__inner:focus) {
  background-color: #1b1f26 !important;
}

:global(html[data-theme='black']) .chat-main {
  background-color: #17191e !important;
}

:global(html[data-theme='black']) .mode-bar {
  background: #1b1e24 !important;
  border-color: #2a2f38 !important;
}

:global(html[data-theme='black']) .mode-bar :global(.el-radio-button__inner) {
  background: #1e2229 !important;
  border-color: #323845 !important;
  color: #d9e0ea !important;
}

:global(html[data-theme='black']) .tree-export-actions {
  background: #17191e !important;
  border-top-color: #252932 !important;
}

:global(html[data-theme='black']) .tree-export-actions :global(.el-radio-button__inner) {
  background: #1e2229 !important;
  border-color: #323845 !important;
  color: #d9e0ea !important;
}

:global(html[data-theme='black']) .tree-export-actions :global(.el-button.is-plain) {
  background: #1d2128 !important;
  border-color: #343b48 !important;
  color: #d9e0ea !important;
}

:global(html[data-theme='black']) .tree-export-actions :global(.el-button.is-plain:hover) {
  background: #242932 !important;
  border-color: #4a5568 !important;
}

:global(html[data-theme='black']) .input-wrapper {
  background-color: #1b1e24 !important;
  border-color: #2b313d !important;
}

:global(html[data-theme='black']) .chat-input :deep(.el-textarea__inner) {
  background-color: #1b1e24 !important;
  color: #f0f4fa !important;
}

.typing-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 4px;
}

.typing-indicator span {
  display: inline-block;
  width: 6px;
  height: 6px;
  background-color: #909399;
  border-radius: 50%;
  animation: typing 1.4s infinite ease-in-out;
}

.typing-indicator span:nth-child(1) {
  animation-delay: 0s;
}

.typing-indicator span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-indicator span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.5;
  }

  50% {
    transform: scale(1.5);
    opacity: 1;
  }
}

.chat-bubble-container {
  margin-bottom: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.message-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  max-width: 100%;
}

.user-row {
  justify-content: flex-end;
}

.ai-row {
  justify-content: flex-start;
}

.avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: bold;
  flex-shrink: 0;
  background-color: transparent;
}

.avatar-icon {
  background-color: #e0e0e0;
}

.ai-icon-bg {
  background-color: var(--primary-color, #4caf50);
  color: white;
}

.user-avatar {
  background-color: transparent;
  color: white;
}

.ai-avatar {
  background-color: transparent;
  color: white;
}

.message-content {
  max-width: 800px;
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 15px;
  line-height: 1.6;
  word-wrap: break-word;
  position: relative;
}

.user-content {
  background-color: var(--primary-color, #4caf50);
  color: white;
  border-bottom-right-radius: 4px;
}

.ai-content {
  background-color: var(--bg-color, #fff);
  border: 1px solid var(--border-color, #e4e7ed);
  color: var(--text-color, #333);
  border-bottom-left-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.message-content-wrapper {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.pending-exchange {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 0;
}

/* Agent 执行轨迹：跟随在刚生成的知识节点气泡下方 */
.trace-after-bubble {
  margin-bottom: 24px;
}

.streaming-bubble {
  min-width: 60px;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.65;
}

.streaming-text {
  display: inline;
}

.stream-cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  background: currentColor;
  margin-left: 2px;
  vertical-align: text-bottom;
  animation: blink-cursor 0.85s step-end infinite;
}

@keyframes blink-cursor {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}

@media (max-width: 1180px) {
  .content-container {
    flex-direction: column;
  }

  .tree-aside {
    width: 100% !important;
    flex-basis: auto !important;
    min-width: 0;
    min-height: min(52vh, 560px);
    border-right: none;
    border-bottom: 1px solid var(--border-color, #dcdfe6);
  }

  .chat-main {
    width: 100% !important;
    flex-basis: auto !important;
    min-height: 0;
  }
}

@media (max-width: 820px) {
  .header {
    padding: 0 14px;
  }

  .logo {
    font-size: 18px;
  }

  .tree-export-actions {
    padding: 10px;
  }

  .export-scope-bar,
  .mode-bar,
  .anchor-preview {
    flex-direction: column;
    align-items: flex-start;
  }

  .chat-list {
    padding: 14px;
    padding-bottom: 220px;
  }

  .input-area {
    padding: 12px 14px;
  }

  .input-wrapper,
  .mode-bar,
  .anchor-preview,
  .context-preview {
    max-width: 100%;
  }
}

/* ===== 新增：挂载条 / 欢迎页 / 导出 popover ===== */
.logo-tag {
  margin-left: 12px;
  font-size: 12px;
  font-weight: 400;
  color: #64748b;
  letter-spacing: 0.02em;
}
:global([data-theme='black']) .logo-tag {
  color: #9aa1ad;
}
@media (max-width: 820px) {
  .logo-tag {
    display: none;
  }
}

.welcome-tip {
  max-width: 480px;
  margin: 8px auto 18px;
  font-size: 14px;
  line-height: 1.7;
  color: #64748b;
}
.welcome-hints {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  font-size: 13px;
}
.welcome-chip {
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(24, 144, 255, 0.08);
  color: #1d4ed8;
  border: 1px solid rgba(24, 144, 255, 0.18);
}
:global([data-theme='black']) .welcome-chip {
  background: rgba(45, 125, 255, 0.12);
  border-color: rgba(90, 132, 195, 0.4);
  color: #bfd7ff;
}
:global([data-theme='black']) .welcome-tip {
  color: #9aa8bd;
}

.mount-bar {
  max-width: 800px;
  margin: 0 auto 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 14px;
  border-radius: 12px;
  border: 1px solid #dfe8f7;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
}
.mount-target {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}
.mount-target-icon {
  color: var(--primary-color, #1890ff);
  font-size: 15px;
  flex-shrink: 0;
}
.mount-target-text {
  font-size: 13px;
  font-weight: 500;
  color: #334155;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
:global([data-theme='black']) .mount-bar {
  background: #1d2026;
  border-color: #2d323c;
}
:global([data-theme='black']) .mount-target-text {
  color: #d4d9e2;
}
:global([data-theme='black']) .mount-target-icon {
  color: #6aa2ff;
}

/* 导出触发按钮 + Popover */
.export-toolbar {
  display: flex;
  gap: 8px;
}
.export-trigger {
  width: 100%;
}
.export-popover-body {
  display: grid;
  gap: 10px;
}
.export-popover-title {
  font-size: 13px;
  font-weight: 700;
  color: #334155;
  margin-bottom: 2px;
}
.export-button-grid {
  display: grid;
  gap: 6px;
}
.export-button-grid .el-button {
  justify-content: flex-start;
  width: 100%;
}
.export-popover-hint {
  margin: 6px 0 0;
  font-size: 11.5px;
  line-height: 1.65;
  color: #64748b;
}
:global(.export-popover) {
  padding: 12px !important;
  border-radius: 12px !important;
}
:global([data-theme='black']) .export-popover-title {
  color: #d5dde8;
}
:global([data-theme='black']) .export-popover-hint {
  color: #9aa1ad;
}
</style>
