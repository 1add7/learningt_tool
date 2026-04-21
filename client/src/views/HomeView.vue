<script setup lang="ts">
import { ref, onMounted, watch, computed, nextTick } from 'vue';
import { useKnowledgeStore } from '../stores/knowledge';
import KnowledgeTree from '../components/KnowledgeTree.vue';
import ChatBubble from '../components/ChatBubble.vue';
import type { KnowledgeNode } from '../types';
import { ElMessage } from 'element-plus';
import { Moon, Sunny, Share, Position, ChatLineRound, DataAnalysis, User, Service, Download } from '@element-plus/icons-vue';
import { useTheme } from '../composables/useTheme';
import { useChat } from '../composables/useChat';
import { useExport } from '../composables/useExport';
import { useContext } from '../composables/useContext';
import { useMountMode } from '../composables/useMountMode';

const store = useKnowledgeStore();
const knowledgeTreeRef = ref<InstanceType<typeof KnowledgeTree> | null>(null);
const chatListRef = ref<HTMLElement | null>(null);

const { isDark, toggleTheme } = useTheme();
const { newQuestion, pendingQuestion, handleAsk: askQuestion, scrollToBottom } = useChat(chatListRef);
const {
  exportingXMind,
  exportingMarkdown,
  exportScope,
  exportHighlightColor,
  exportPathNodeIds,
  exportTargetNodes,
  handleExportXMind,
  handleExportMarkdown,
  setExportHighlight,
  clearExportHighlight,
  addExportTarget,
  removeExportTarget,
  clearExportTargets
} = useExport();
const {
  selectedContexts,
  addContext,
  removeContext,
  clearAllContexts,
  handleDragStart,
  handleDrop,
  handleDragEnd,
  mergedContext
} = useContext();
const { askMode, anchorTargetNodeId, anchorTargetNode } = useMountMode(selectedContexts);

const modeBarInlineStyle = computed(() => (isDark.value
  ? { background: '#1b1e24', borderColor: '#2a2f38' }
  : {}));

const exportActionsInlineStyle = computed(() => (isDark.value
  ? { background: '#17191e', borderTopColor: '#252932' }
  : {}));

const inputWrapperInlineStyle = computed(() => (isDark.value
  ? { backgroundColor: '#1b1e24', borderColor: '#2b313d' }
  : {}));

const exportSelectingMode = computed(() => exportScope.value === 'selected-path');

onMounted(() => {
  store.fetchNodes();
});

watch(() => store.currentChatHistory.length, () => {
  scrollToBottom();
});

watch(() => exportScope.value, async () => {
  await nextTick();
  knowledgeTreeRef.value?.updateChart();
});

const handleNodeClick = async (node: KnowledgeNode) => {
  if (exportScope.value === 'selected-path') {
    addExportTarget(node._id);
    ElMessage.success(`已加入导出终点`);
  }
  await store.restoreSession(node._id);
  scrollToBottom();
};

const handleSelectText = (payload: { text: string; sourceNodeId: string }) => {
  addContext(payload.text, payload.sourceNodeId);
};

const onSubmit = async () => {
  await askQuestion({
    context: mergedContext.value,
    parentId: anchorTargetNodeId.value || undefined
  });
};

const generateTest = () => {
  store.generateTestTree();
  ElMessage.success('已生成 10 级测试数据');
};
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
          <span class="logo-text">AI学习树</span>
        </div>
        <div class="header-controls">
          <el-tooltip content="生成10级测试数据" placement="bottom">
            <el-button @click="generateTest" circle size="small" :icon="DataAnalysis" class="mr-2" />
          </el-tooltip>
          <div class="theme-switch">
            <el-switch v-model="isDark" inline-prompt :active-icon="Moon" :inactive-icon="Sunny"
              @change="toggleTheme" />
          </div>
        </div>
      </el-header>

      <el-container class="content-container" :class="{ 'export-selecting': exportSelectingMode }">
        <el-aside class="tree-aside">
          <div class="tree-panel">
            <KnowledgeTree ref="knowledgeTreeRef" :data="store.treeData" :preview-node-id="anchorTargetNodeId"
              :export-path-node-ids="exportPathNodeIds" :export-path-color="exportHighlightColor"
              @node-click="handleNodeClick" />
          </div>
          <div class="tree-export-actions" :style="exportActionsInlineStyle">
            <div class="export-scope-bar">
              <span class="export-scope-title">导出范围</span>
              <el-radio-group v-model="exportScope" size="small">
                <el-radio-button label="all">全部节点</el-radio-button>
                <el-radio-button label="selected-path">选中节点路径</el-radio-button>
              </el-radio-group>
            </div>
            <div v-if="exportScope === 'selected-path'" class="export-path-tip">
              {{ exportTargetNodes.length ? `已选终点 ${exportTargetNodes.length} 个，导出将合并所有终点到根节点路径` :
                '请在知识树中点击节点加入导出终点（可多选）' }}
            </div>
            <div v-if="exportScope === 'selected-path'" class="export-target-actions">
              <el-button size="small" text type="danger" @click="clearExportTargets">清空终点</el-button>
            </div>
            <div v-if="exportScope === 'selected-path' && exportTargetNodes.length" class="export-target-list">
              <span v-for="node in exportTargetNodes" :key="node._id" class="export-target-item">
                <span class="export-target-text">{{ node.question }}</span>
                <button class="export-target-remove" type="button" @click="removeExportTarget(node._id)">×</button>
              </span>
            </div>
            <el-button type="primary" plain :icon="Download" :loading="exportingXMind" @click="handleExportXMind"
              @mouseenter="setExportHighlight('#2d7dff')" @mouseleave="clearExportHighlight">
              导出 XMind
            </el-button>
            <el-button type="success" plain :icon="Download" :loading="exportingMarkdown" @click="handleExportMarkdown"
              @mouseenter="setExportHighlight('#67c23a')" @mouseleave="clearExportHighlight">
              导出 Markdown 目录包
            </el-button>
          </div>
        </el-aside>

        <el-main class="chat-main">
          <div class="chat-list" ref="chatListRef">
            <div v-if="store.currentChatHistory.length === 0" class="welcome-placeholder">
              <div class="welcome-content">
                <el-icon :size="60" class="welcome-icon">
                  <ChatLineRound />
                </el-icon>
                <h2>开启新的知识探索</h2>
                <p>在下方输入问题，AI 将为您构建知识体系</p>
              </div>
            </div>

            <div v-else class="chat-bubbles">
              <ChatBubble v-for="node in store.currentChatHistory" :key="node._id" :node="node"
                @select-text="handleSelectText" />
              <div v-if="store.loading" class="chat-bubble-container pending-bubble">
                <div class="message-row user-row">
                  <div class="message-content user-content">
                    <p>{{ pendingQuestion }}</p>
                  </div>
                  <div class="avatar user-avatar">
                    <el-avatar :icon="User" size="small" class="avatar-icon" />
                  </div>
                </div>
                <div class="message-row ai-row">
                  <div class="avatar ai-avatar">
                    <el-avatar :icon="Service" size="small" class="avatar-icon ai-icon-bg" />
                  </div>
                  <div class="message-content-wrapper">
                    <div class="message-content ai-content loading-content">
                      <div class="typing-indicator">
                        <span></span><span></span><span></span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="input-area">
            <div class="mode-bar" :style="modeBarInlineStyle">
              <span class="mode-title">挂载模式</span>
              <el-radio-group v-model="askMode" size="small" class="ask-mode-switch">
                <el-radio-button label="followup">当前节点挂载</el-radio-button>
                <el-radio-button label="context-anchor">上下文锚点挂载</el-radio-button>
              </el-radio-group>
            </div>
            <div v-if="askMode === 'context-anchor'" class="anchor-preview" :class="{ active: anchorTargetNode }">
              <span class="anchor-preview-label">预计挂载节点</span>
              <span class="anchor-preview-value">
                {{ anchorTargetNode ? anchorTargetNode.question : '请先选中上下文片段' }}
              </span>
            </div>
            <div v-if="selectedContexts.length" class="context-preview">
              <div class="context-head">
                <div class="context-head-left">
                  <span class="context-title">已选中上下文（{{ selectedContexts.length }}）</span>
                </div>
                <el-button text type="danger" @click="clearAllContexts">清空</el-button>
              </div>
              <div class="context-list">
                <div v-for="(ctx, index) in selectedContexts" :key="ctx.id" class="context-item" draggable="true"
                  @dragstart="handleDragStart(index)" @dragover.prevent @drop="handleDrop(index)"
                  @dragend="handleDragEnd">
                  <span class="context-index">{{ index + 1 }}</span>
                  <span class="context-content">{{ ctx.text }}</span>
                  <el-button text type="danger" class="context-close" @click="removeContext(index)">移除</el-button>
                </div>
              </div>
              <div class="context-merged">
                <span class="merged-label">拼接预览</span>
                <p>{{ mergedContext }}</p>
              </div>
            </div>
            <div class="input-wrapper" :style="inputWrapperInlineStyle">
              <el-input v-model="newQuestion" type="textarea" :rows="1" :autosize="{ minRows: 1, maxRows: 4 }"
                :placeholder="store.currentChatHistory.length > 0 ? '继续追问...' : '输入您的问题...'" class="chat-input"
                @keydown.enter.prevent="onSubmit" :disabled="store.loading" />
              <el-button @click="onSubmit" :loading="store.loading" type="primary" circle class="send-btn"
                :disabled="!newQuestion.trim() || store.loading">
                <el-icon>
                  <Position />
                </el-icon>
              </el-button>
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
  background: linear-gradient(135deg, var(--primary-color, #4CAF50), #2f8dff);
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
}

.content-container.export-selecting .tree-aside {
  width: 58%;
}

.content-container.export-selecting .chat-main {
  width: 42%;
}

.tree-aside {
  border-right: 1px solid var(--border-color, #dcdfe6);
  background: var(--tree-panel-bg, linear-gradient(180deg, #f8fbff 0%, #f3f7ff 100%));
  display: flex;
  flex-direction: column;
  width: 43%;
  flex-shrink: 0;
  min-height: 0;
}

.tree-panel {
  flex: 1;
  min-height: 0;
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
  flex-shrink: 0;
}

.chat-list {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  padding-bottom: 130px;
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
  color: var(--primary-color, #4CAF50);
  opacity: 0.5;
}

.input-area {
  position: absolute;
  bottom: 10px;
  left: 0;
  right: 0;
  padding: 14px 20px;
  background: transparent;
  z-index: 10;
}

.input-wrapper {
  max-width: 800px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 10px;
  background-color: #f4f4f5;
  padding: 10px;
  border-radius: 24px;
  border: 1px solid transparent;
  transition: border-color 0.3s;
}

.input-wrapper:focus-within {
  border-color: var(--primary-color, #4CAF50);
  background-color: #fff;
  box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.1);
}

.chat-input :deep(.el-textarea__inner) {
  box-shadow: none;
  background-color: transparent;
  border: none;
  padding: 8px 0;
  resize: none;
  min-height: 40px;
  line-height: 24px;
}

.chat-input :deep(.el-textarea__inner::placeholder) {
  line-height: 24px;
}

.send-btn {
  flex-shrink: 0;
  width: 38px;
  height: 38px;
}

.mode-bar {
  max-width: 800px;
  margin: 0 auto 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid #dfe8f7;
  background: rgba(255, 255, 255, 0.92);
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

.ask-mode-switch {
  display: inline-flex;
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
  transition: border-color 0.2s, background-color 0.2s;
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

:global([data-theme='black']) .tree-export-actions :global(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
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

:global([data-theme='black']) .mode-title {
  color: #9aa1ad;
}

:global([data-theme='black']) .mode-bar :global(.el-radio-button__inner) {
  background: #1f2229;
  color: #bcc6d4;
  border-color: #313744;
}

:global([data-theme='black']) .mode-bar :global(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
  background: #315d9f;
  border-color: #315d9f;
  color: #ffffff;
  box-shadow: -1px 0 0 0 #315d9f;
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
  background-color: var(--primary-color, #4CAF50);
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
  background-color: var(--primary-color, #4CAF50);
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

.loading-content {
  min-width: 60px;
  display: flex;
  justify-content: center;
}

.pending-bubble {
  margin-bottom: 0;
}
</style>
