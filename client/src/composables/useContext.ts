import { ref, computed } from 'vue';
import { ElMessage } from 'element-plus';

export interface ContextItem {
  id: string;
  text: string;
  sourceNodeId: string;
}

export function useContext() {
  const selectedContexts = ref<ContextItem[]>([]);
  const dragFromIndex = ref<number | null>(null);

  const addContext = (text: string, sourceNodeId: string) => {
    const trimmedText = text.trim();
    if (!trimmedText) return false;

    const exists = selectedContexts.value.some(
      item => item.text === trimmedText && item.sourceNodeId === sourceNodeId
    );

    if (!exists) {
      selectedContexts.value.push({
        id: `${sourceNodeId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        text: trimmedText,
        sourceNodeId
      });
      ElMessage.info({
        message: `已加入上下文（${selectedContexts.value.length}段）`,
        duration: 2000
      });
      return true;
    }
    return false;
  };

  const removeContext = (index: number) => {
    selectedContexts.value.splice(index, 1);
  };

  const clearAllContexts = () => {
    selectedContexts.value = [];
  };

  const handleDragStart = (index: number) => {
    dragFromIndex.value = index;
  };

  const handleDrop = (targetIndex: number) => {
    if (dragFromIndex.value === null || dragFromIndex.value === targetIndex) return;
    const moved = selectedContexts.value[dragFromIndex.value];
    if (!moved) return;
    selectedContexts.value.splice(dragFromIndex.value, 1);
    selectedContexts.value.splice(targetIndex, 0, moved);
    dragFromIndex.value = null;
  };

  const handleDragEnd = () => {
    dragFromIndex.value = null;
  };

  const mergedContext = computed(() => {
    return selectedContexts.value.map(item => item.text).join('\n');
  });

  return {
    selectedContexts,
    dragFromIndex,
    addContext,
    removeContext,
    clearAllContexts,
    handleDragStart,
    handleDrop,
    handleDragEnd,
    mergedContext
  };
}
