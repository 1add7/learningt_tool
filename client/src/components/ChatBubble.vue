<script setup lang="ts">
import { ref } from 'vue';
import { Aim, User, Service } from '@element-plus/icons-vue';
import type { KnowledgeNode } from '../types';

const props = defineProps<{
  node: KnowledgeNode;
}>();

const emit = defineEmits<{
  (e: 'select-text', payload: { text: string; sourceNodeId: string }): void;
}>();

const answerRef = ref<HTMLElement | null>(null);
const showPopover = ref(false);
const popoverPosition = ref({ x: 0, y: 0 });
const selectedText = ref('');

const handleMouseUp = () => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const text = selection.toString().trim();
  if (text && answerRef.value && answerRef.value.contains(selection.anchorNode)) {
    selectedText.value = text;
    // Calculate position relative to viewport
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    popoverPosition.value = {
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    };
    showPopover.value = true;
  } else {
    showPopover.value = false;
  }
};

const handleAskSelection = () => {
  emit('select-text', {
    text: selectedText.value,
    sourceNodeId: props.node._id
  });
  showPopover.value = false;
  window.getSelection()?.removeAllRanges();
};
</script>

<template>
  <div class="chat-bubble-container">
    <!-- User Question -->
    <div class="message-row user-row">
      <div class="message-content user-content">
        {{ node.question }}
      </div>
      <div class="avatar user-avatar">
        <el-avatar :icon="User" size="small" class="avatar-icon" />
      </div>
    </div>

    <!-- AI Answer -->
    <div class="message-row ai-row">
      <div class="avatar ai-avatar">
        <el-avatar :icon="Service" size="small" class="avatar-icon ai-icon-bg" />
      </div>
      <div class="message-content-wrapper">
        <div ref="answerRef" class="message-content ai-content" @mouseup="handleMouseUp">
          {{ node.answer }}
        </div>
        <div v-if="node.context" class="context-tag">
          <el-tag size="small" type="info" effect="plain">基于选中上下文回答</el-tag>
        </div>
      </div>
    </div>

    <!-- Floating Action Button for Selection -->
    <Teleport to="body">
      <div v-if="showPopover" class="selection-popover"
        :style="{ top: `${popoverPosition.y}px`, left: `${popoverPosition.x}px` }">
        <el-button type="primary" size="small" round @click="handleAskSelection">
          <el-icon class="mr-1">
            <Aim />
          </el-icon> 选中
        </el-button>
        <div class="popover-arrow"></div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
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

.message-content {
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 15px;
  line-height: 1.6;
  max-width: 800px;
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

.avatar-icon {
  background-color: #e0e0e0;
}

.ai-icon-bg {
  background-color: var(--primary-color, #4CAF50);
  color: white;
}

.message-content-wrapper {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.context-tag {
  margin-left: 4px;
  opacity: 0.8;
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
  border-top: 6px solid var(--primary-color, #4CAF50);
  /* Match button color */
}

.mr-1 {
  margin-right: 4px;
}
</style>
