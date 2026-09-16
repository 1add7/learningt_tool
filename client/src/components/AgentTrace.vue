<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowRight, Connection, Document, Loading, Search } from '@element-plus/icons-vue'
import type { AgentStep, AgentTraceState } from '../composables/useChat'

const props = defineProps<{
  state: AgentTraceState
  /** 是否处于流式执行中（运行中默认展开，结束后自动收起） */
  live?: boolean
}>()

const emit = defineEmits<{
  (e: 'focus-node', nodeId: string): void
}>()

const expanded = ref(props.live ?? false)

watch(
  () => props.live,
  (value) => {
    expanded.value = Boolean(value)
  },
)

const TOOL_META: Record<string, { label: string; icon: unknown }> = {
  search_knowledge_tree: { label: '检索知识树', icon: Search },
  get_node_context: { label: '获取节点上下文', icon: Document },
  web_search: { label: '联网搜索', icon: Connection },
}

const toolLabel = (tool: string) => TOOL_META[tool]?.label ?? tool

const toolIcon = (tool: string) => TOOL_META[tool]?.icon ?? Search

const MODE_LABEL: Record<string, string> = {
  vector: '向量检索',
  keyword: '关键词检索',
  context: '上下文链路',
}

const modeLabel = (mode: string) => MODE_LABEL[mode] ?? mode

const stepCount = computed(() => props.state.steps.length)

const headline = computed(() => {
  if (props.state.active) return 'Agent 正在执行'
  if (props.state.usedAgent) return `Agent 完成推理 · ${props.state.iterations} 轮`
  return '检索增强问答'
})

const argSummary = (step: AgentStep) => {
  const args = step.args ?? {}
  const value = args.query ?? args.node_id ?? args.nodeId
  const text = typeof value === 'string' ? value : JSON.stringify(args)
  return text.length > 64 ? `${text.slice(0, 64)}…` : text
}
</script>

<template>
  <div class="agent-trace" :class="{ 'is-live': live }">
    <button class="trace-head" type="button" @click="expanded = !expanded">
      <el-icon class="head-caret" :class="{ 'is-open': expanded }"><ArrowRight /></el-icon>
      <span class="head-title">{{ headline }}</span>
      <span class="head-meta">
        <span v-if="stepCount" class="meta-chip">{{ stepCount }} 次工具调用</span>
        <span v-if="state.citations.length" class="meta-chip">
          {{ state.citations.length }} 处引用
        </span>
        <span v-if="state.active" class="meta-live"><i></i>运行中</span>
      </span>
    </button>

    <div v-show="expanded" class="trace-body">
      <p v-if="state.statusMessage" class="trace-status">{{ state.statusMessage }}</p>

      <ol v-if="state.steps.length" class="trace-steps">
        <li v-for="step in state.steps" :key="step.id" class="trace-step">
          <div class="step-head">
            <el-icon class="step-state" :class="step.status">
              <Loading v-if="step.status === 'running'" />
              <component :is="toolIcon(step.tool)" v-else />
            </el-icon>
            <span class="step-label">{{ toolLabel(step.tool) }}</span>
            <span class="step-arg">{{ argSummary(step) }}</span>
          </div>
          <p v-if="step.content" class="step-content">{{ step.content }}</p>
        </li>
      </ol>

      <details v-if="state.thinkingText" class="trace-thinking">
        <summary>查看模型思考原文</summary>
        <pre>{{ state.thinkingText }}</pre>
      </details>

      <div v-if="state.citations.length" class="trace-citations">
        <span class="citations-title">引用来源</span>
        <button
          v-for="(citation, index) in state.citations"
          :key="citation.nodeId"
          class="citation-item"
          type="button"
          title="在左侧知识树中定位该节点"
          @click="emit('focus-node', citation.nodeId)"
        >
          <span class="citation-index">{{ index + 1 }}</span>
          <span class="citation-text">{{ citation.question }}</span>
          <span class="citation-mode">{{ modeLabel(citation.mode) }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.agent-trace {
  margin: 0;
  border: 1px dashed var(--border-color, #dcdfe6);
  border-radius: 10px;
  background: rgba(24, 144, 255, 0.03);
  overflow: hidden;
}

.agent-trace.is-live {
  border-style: solid;
  border-color: rgba(24, 144, 255, 0.45);
}

.trace-head {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-color, #475569);
  text-align: left;
}

.trace-head:hover {
  background: rgba(24, 144, 255, 0.06);
}

.head-caret {
  transition: transform 0.18s ease;
  color: #94a3b8;
}

.head-caret.is-open {
  transform: rotate(90deg);
}

.head-title {
  font-weight: 600;
}

.head-meta {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
  color: #94a3b8;
  font-size: 12px;
}

.meta-chip {
  padding: 1px 8px;
  border-radius: 8px;
  background: rgba(148, 163, 184, 0.16);
}

.meta-live {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--primary-color, #1890ff);
}

.meta-live i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  animation: trace-pulse 1.2s infinite ease-in-out;
}

@keyframes trace-pulse {
  0%,
  100% {
    opacity: 0.35;
  }
  50% {
    opacity: 1;
  }
}

.trace-body {
  padding: 0 12px 10px;
  font-size: 12.5px;
}

.trace-status {
  margin: 0 0 8px;
  color: #64748b;
}

.trace-steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.trace-step {
  padding-left: 10px;
  border-left: 2px solid rgba(24, 144, 255, 0.25);
}

.step-head {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #334155;
}

.step-state {
  color: #94a3b8;
}

.step-state.running {
  color: var(--primary-color, #1890ff);
  animation: trace-spin 1s linear infinite;
}

.step-state.failed {
  color: #f56c6c;
}

@keyframes trace-spin {
  to {
    transform: rotate(360deg);
  }
}

.step-label {
  font-weight: 600;
}

.step-arg {
  color: #94a3b8;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 320px;
}

.step-content {
  margin: 4px 0 0;
  padding: 6px 8px;
  border-radius: 6px;
  background: rgba(148, 163, 184, 0.1);
  color: #64748b;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 132px;
  overflow-y: auto;
  line-height: 1.55;
}

.trace-thinking {
  margin-top: 8px;
  color: #64748b;
}

.trace-thinking summary {
  cursor: pointer;
}

.trace-thinking pre {
  margin: 6px 0 0;
  padding: 8px;
  border-radius: 6px;
  background: rgba(148, 163, 184, 0.1);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 180px;
  overflow-y: auto;
  font-family: inherit;
  line-height: 1.55;
}

.trace-citations {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.citations-title {
  color: #94a3b8;
}

.citation-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: rgba(24, 144, 255, 0.07);
  cursor: pointer;
  text-align: left;
  color: #334155;
  font-size: 12.5px;
}

.citation-item:hover {
  border-color: var(--primary-color, #1890ff);
}

.citation-index {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--primary-color, #1890ff);
  color: #fff;
  font-size: 11px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.citation-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.citation-mode {
  margin-left: auto;
  flex-shrink: 0;
  color: #94a3b8;
}

:global(html[data-theme='black']) .agent-trace {
  background: rgba(45, 125, 255, 0.08);
  border-color: #2c2f38;
}

:global(html[data-theme='black']) .trace-head,
:global(html[data-theme='black']) .step-head,
:global(html[data-theme='black']) .citation-item {
  color: #d4d9e2;
}

:global(html[data-theme='black']) .step-content,
:global(html[data-theme='black']) .trace-thinking pre {
  background: rgba(148, 163, 184, 0.12);
  color: #9ba7ba;
}
</style>
