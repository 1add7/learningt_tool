<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted } from 'vue';
import * as echarts from 'echarts';
import type { KnowledgeNode } from '../types';
import { useKnowledgeStore } from '../stores/knowledge';
import { ElMessageBox, ElMessage } from 'element-plus';
import { Delete } from '@element-plus/icons-vue';
import { initKnowledgeTree } from '../utils/knowledgeTreeChart';

const props = defineProps<{
  data: KnowledgeNode[];
  previewNodeId?: string | null;
  exportPathNodeIds?: string[];
  exportPathColor?: string;
}>();

const emit = defineEmits<{
  (e: 'node-click', node: KnowledgeNode): void;
}>();

const store = useKnowledgeStore();
const chartContainer = ref<HTMLElement | null>(null);
let chartInstance: echarts.ECharts | null = null;
const isDeleting = ref(false);

const getCssVar = (name: string) => {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
};

const getTheme = () => {
  return {
    primaryColor: getCssVar('--primary-color') || '#1890ff',
    borderColor: getCssVar('--border-color') || '#d9d9d9',
    hoverBorderColor: getCssVar('--hover-border-color') || '#40a9ff',
    chartLineColor: getCssVar('--chart-line-color') || '#bae7ff',
    textColor: getCssVar('--text-color') || '#333333',
    backgroundColor: getCssVar('--background-color') || '#ffffff'
  };
};

const updateChart = () => {
  if (!chartContainer.value) return;
  const theme = {
    ...getTheme(),
    exportPathNodeIds: props.exportPathNodeIds || [],
    exportPathColor: props.exportPathColor || ''
  };
  chartInstance = initKnowledgeTree(
    chartContainer.value,
    props.data,
    store.selectedNodeId,
    props.previewNodeId || null,
    theme
  );
  setupEvents();
};

const setupEvents = () => {
  if (!chartInstance) return;
  chartInstance.off('click');

  chartInstance.on('click', (params: echarts.ECElementEvent) => {
    if (params.seriesType !== 'tree') {
      return;
    }
    const data = params.data as { originalData?: KnowledgeNode; value?: string } | null | undefined;
    const rawNode = data?.originalData || store.nodes.find(n => n._id === data?.value);
    if (!rawNode || !rawNode._id) {
      return;
    }
    const matchedNode = store.nodes.find(n => n._id === rawNode._id);
    if (matchedNode) {
      store.selectedNodeId = matchedNode._id;
      emit('node-click', matchedNode);
    }
  });
};

const handleDeleteNode = async () => {
  if (!store.selectedNodeId) return;

  const nodeToDelete = store.nodes.find(n => n._id === store.selectedNodeId);
  if (!nodeToDelete) return;

  if (!nodeToDelete.parentId) {
    ElMessage.warning('根节点不可删除');
    return;
  }

  try {
    await ElMessageBox.confirm(
      `确定删除『${nodeToDelete.question}』及其所有子节点？此操作不可恢复。`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );

    isDeleting.value = true;
    await store.deleteNode(nodeToDelete._id);
    store.selectedNodeId = null; // Deselect after delete
  } catch (e) {
    if (e !== 'cancel') {
      console.error(e);
      ElMessage.error('删除失败');
    }
  } finally {
    isDeleting.value = false;
  }
};

// Watch for data changes or selection changes to redraw
watch(() => [props.data, store.selectedNodeId, props.previewNodeId, props.exportPathNodeIds, props.exportPathColor], () => {
  updateChart();
}, { deep: true });

// Resize handler
const handleResize = () => {
  chartInstance?.resize();
};

onMounted(() => {
  setTimeout(() => {
    updateChart();
  }, 100);

  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  chartInstance?.dispose();
});

defineExpose({ updateChart });
</script>

<template>
  <div class="tree-wrapper">
    <div ref="chartContainer" class="chart-container"></div>

    <!-- Delete Button: Absolute positioning with high Z-Index -->
    <div v-if="store.selectedNodeId" class="tree-controls">
      <el-tooltip content="删除当前节点及子节点" placement="left">
        <el-button type="danger" class="tree-delete-btn" circle :icon="Delete" @click="handleDeleteNode"
          :loading="isDeleting" :disabled="!store.nodes.find(n => n._id === store.selectedNodeId)?.parentId" />
      </el-tooltip>
    </div>
  </div>
</template>

<style scoped>
.tree-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: radial-gradient(circle at 15% 20%, rgba(47, 141, 255, 0.09), transparent 36%),
    radial-gradient(circle at 80% 85%, rgba(76, 175, 80, 0.1), transparent 33%);
}

.chart-container {
  width: 100%;
  height: 100%;
  min-height: 460px;
}

.tree-controls {
  position: absolute;
  top: 18px;
  right: 18px;
  z-index: 9999;
}

.tree-delete-btn {
  width: 42px;
  height: 42px;
  border-width: 0;
  box-shadow: 0 8px 22px rgba(239, 68, 68, 0.32);
}

.tree-delete-btn:hover {
  transform: translateY(-1px) scale(1.03);
}
</style>
