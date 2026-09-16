<script setup lang="ts">
import { ref, computed } from 'vue'
import { Aim, CopyDocument } from '@element-plus/icons-vue'
import { marked } from 'marked'
import { ElMessage } from 'element-plus'
import type { KnowledgeNode } from '../types'

const props = defineProps<{
  node: KnowledgeNode
  /** 若为 true，表示这是当前聊天链路的末端（高亮展示） */
  isTail?: boolean
  /** 若为 true，该气泡对应的节点当前在树中处于选中状态 */
  isSelected?: boolean
}>()

const emit = defineEmits<{
  (e: 'select-text', payload: { text: string; sourceNodeId: string }): void
  (e: 'node-focus', nodeId: string): void
}>()

// 配置 marked：开启 GFM 与换行符识别
marked.setOptions({ gfm: true, breaks: true })

const renderedAnswer = computed(() => {
  const raw = (props.node.answer || '').trim()
  if (!raw) return '<p class="ai-empty">（暂无回答）</p>'
  try {
    return marked.parse(raw) as string
  } catch {
    return raw
  }
})

const answerRef = ref<HTMLElement | null>(null)
const showPopover = ref(false)
const popoverPosition = ref({ x: 0, y: 0 })
const selectedText = ref('')

const handleMouseUp = () => {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return

  const text = selection.toString().trim()
  if (text && answerRef.value && answerRef.value.contains(selection.anchorNode)) {
    selectedText.value = text
    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    popoverPosition.value = {
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
    }
    showPopover.value = true
  } else {
    showPopover.value = false
  }
}

const handleAskSelection = () => {
  emit('select-text', {
    text: selectedText.value,
    sourceNodeId: props.node._id,
  })
  showPopover.value = false
  window.getSelection()?.removeAllRanges()
}

const handleCopyAnswer = async () => {
  try {
    await navigator.clipboard.writeText(props.node.answer || '')
    ElMessage.success('回答已复制')
  } catch {
    ElMessage.warning('复制失败，请手动选择复制')
  }
}
</script>

<template>
  <div class="chat-bubble-container" :class="{ 'is-tail': isTail, 'is-node-selected': isSelected }">
    <!-- 用户提问 — 点击可将该节点设为树的选中节点 -->
    <div
      class="message-row user-row"
      role="button"
      tabindex="0"
      title="点击在左侧树中定位该节点"
      @click="emit('node-focus', node._id)"
      @keydown.enter="emit('node-focus', node._id)"
    >
      <div class="message-content user-content">
        {{ node.question }}
      </div>
    </div>

    <!-- AI 回答 -->
    <div class="message-row ai-row">
      <div class="message-content-wrapper">
        <div
          ref="answerRef"
          class="message-content ai-content markdown-body"
          @mouseup="handleMouseUp"
          v-html="renderedAnswer"
        ></div>
        <div class="ai-meta">
          <el-tag v-if="node.context" size="small" type="info" effect="plain">基于上下文</el-tag>
          <el-tag size="small" type="success" effect="plain">Lv.{{ node.level ?? 0 }}</el-tag>
          <el-button text size="small" :icon="CopyDocument" @click="handleCopyAnswer">
            复制
          </el-button>
        </div>
        <!-- Agent 回答引用的知识来源，点击可跳回对应节点 -->
        <div v-if="node.citations?.length" class="citation-list">
          <span class="citation-title">引用来源</span>
          <button
            v-for="(citation, index) in node.citations"
            :key="citation.nodeId"
            class="citation-chip"
            type="button"
            title="在左侧知识树中定位该节点"
            @click="emit('node-focus', citation.nodeId)"
          >
            <span class="citation-index">{{ index + 1 }}</span>
            {{ citation.question }}
          </button>
        </div>
      </div>
    </div>

    <!-- 悬浮"选中提问"按钮 -->
    <Teleport to="body">
      <div
        v-if="showPopover"
        class="selection-popover"
        :style="{ top: `${popoverPosition.y}px`, left: `${popoverPosition.x}px` }"
      >
        <el-button type="primary" size="small" round @click="handleAskSelection">
          <el-icon class="mr-1"><Aim /></el-icon>作为上下文
        </el-button>
        <div class="popover-arrow"></div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.chat-bubble-container {
  margin-bottom: 22px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 6px 4px;
  border-radius: 12px;
  border: 2px solid transparent;
  transition: border-color 0.2s;
}

/* currently active node in the tree */
.chat-bubble-container.is-node-selected {
  border-color: var(--primary-color, #1890ff);
  background: rgba(24, 144, 255, 0.04);
}

.chat-bubble-container.is-tail .ai-content {
  border-color: var(--primary-color, #1890ff);
  box-shadow: 0 4px 14px rgba(24, 144, 255, 0.12);
}

.message-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  max-width: 100%;
}
.user-row {
  justify-content: flex-end;
  align-items: flex-end;
  cursor: pointer;
  border-radius: 10px;
  transition: opacity 0.15s;
}
.user-row:hover {
  opacity: 0.88;
}
.user-row:hover .user-content {
  box-shadow: 0 6px 18px rgba(24, 144, 255, 0.35);
}
.ai-row {
  justify-content: flex-start;
}

.message-content {
  padding: 10px 14px;
  border-radius: 14px;
  font-size: 14px;
  line-height: 1.65;
  max-width: min(72%, 640px);
  word-wrap: break-word;
  position: relative;
}

.user-content {
  background: linear-gradient(135deg, var(--primary-color, #1890ff), var(--accent-color, #40a9ff));
  color: #fff;
  border-bottom-right-radius: 4px;
  box-shadow: 0 4px 12px rgba(24, 144, 255, 0.2);
}

.ai-content {
  background-color: var(--bg-color, #fff);
  border: 1px solid var(--border-color, #e4e7ed);
  color: var(--text-color, #333);
  border-bottom-left-radius: 4px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
}

.message-content-wrapper {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  max-width: 78%;
}

.ai-meta {
  margin-left: 2px;
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}

.citation-list {
  width: 100%;
  margin-left: 2px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.citation-title {
  font-size: 12px;
  color: #94a3b8;
}

.citation-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  padding: 2px 10px 2px 4px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: rgba(24, 144, 255, 0.08);
  color: var(--text-color, #475569);
  font-size: 12px;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.citation-chip:hover {
  border-color: var(--primary-color, #1890ff);
}

.citation-index {
  flex-shrink: 0;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: var(--primary-color, #1890ff);
  color: #fff;
  font-size: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.selection-popover {
  position: fixed;
  transform: translate(-50%, -100%);
  z-index: 9999;
  margin-top: -10px;
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.15));
}

.popover-arrow {
  position: absolute;
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 6px solid var(--primary-color, #1890ff);
}

.mr-1 {
  margin-right: 4px;
}

/* ===== Markdown 内容样式 ===== */
.markdown-body :deep(p) {
  margin: 0 0 8px;
}
.markdown-body :deep(p:last-child) {
  margin-bottom: 0;
}
.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4) {
  margin: 12px 0 6px;
  line-height: 1.35;
  font-weight: 700;
  color: var(--text-color, #111);
}
.markdown-body :deep(h1) {
  font-size: 1.25em;
}
.markdown-body :deep(h2) {
  font-size: 1.15em;
}
.markdown-body :deep(h3) {
  font-size: 1.05em;
}
.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 1.4em;
  margin: 6px 0 10px;
}
.markdown-body :deep(li) {
  margin: 3px 0;
}
.markdown-body :deep(code) {
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 0.9em;
  background: rgba(110, 118, 129, 0.12);
  font-family: 'JetBrains Mono', 'Fira Code', Consolas, Monaco, monospace;
}
.markdown-body :deep(pre) {
  margin: 8px 0;
  padding: 12px 14px;
  border-radius: 10px;
  background: #0f172a;
  color: #e2e8f0;
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.55;
}
.markdown-body :deep(pre code) {
  padding: 0;
  background: transparent;
  color: inherit;
  font-size: inherit;
}
.markdown-body :deep(blockquote) {
  margin: 8px 0;
  padding: 4px 12px;
  border-left: 3px solid var(--primary-color, #1890ff);
  background: rgba(24, 144, 255, 0.06);
  color: #475569;
  border-radius: 0 8px 8px 0;
}
.markdown-body :deep(a) {
  color: var(--primary-color, #1890ff);
  text-decoration: none;
}
.markdown-body :deep(a:hover) {
  text-decoration: underline;
}
.markdown-body :deep(table) {
  border-collapse: collapse;
  margin: 8px 0;
  font-size: 13px;
  width: 100%;
}
.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid var(--border-color, #d9d9d9);
  padding: 6px 10px;
}
.markdown-body :deep(th) {
  background: rgba(0, 0, 0, 0.03);
}
.markdown-body :deep(hr) {
  border: none;
  border-top: 1px dashed var(--border-color, #d9d9d9);
  margin: 10px 0;
}
.markdown-body :deep(.ai-empty) {
  color: #94a3b8;
  font-style: italic;
}

/* 暗色主题 */
:global([data-theme='black']) .ai-content {
  background-color: #1e1f24;
  border-color: #2c2f38;
  color: #d4d9e2;
}
:global([data-theme='black']) .markdown-body :deep(code) {
  background: rgba(148, 163, 184, 0.14);
  color: #e2e8f0;
}
:global([data-theme='black']) .markdown-body :deep(blockquote) {
  background: rgba(45, 125, 255, 0.1);
  color: #9ba7ba;
}
</style>
