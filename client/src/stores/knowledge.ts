import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { getNodes, createNode, deleteNode as apiDeleteNode } from '../api/knowledge';
import type { KnowledgeNode } from '../types';
import { ElMessage } from 'element-plus';
import { memoryTree } from '../utils/MemoryTree';
import { buildTree } from '../utils/treeBuilder';
import { generateTestTree as generateTestTreeNodes } from '../utils/testDataGenerator';

export const useKnowledgeStore = defineStore('knowledge', () => {
  const nodes = ref<KnowledgeNode[]>([]);
  const currentChatHistory = ref<KnowledgeNode[]>([]);
  const selectedNodeId = ref<string | null>(null);
  const sessionId = ref(localStorage.getItem('sessionId') || generateSessionId());
  const loading = ref(false);
  const usingTestTree = ref(false);

  function generateSessionId() {
    const id = 'sess-' + Date.now().toString(36) + Math.random().toString(36).substring(2);
    localStorage.setItem('sessionId', id);
    return id;
  }

  function isTestTreeNode(id: string) {
    return id.startsWith('root-test-') || /^node-[a-z0-9]+-\d+-\d+-\d+$/.test(id);
  }

  async function fetchNodes() {
    loading.value = true;
    try {
      const res = await getNodes(sessionId.value);
      if (Array.isArray(res.data)) {
        nodes.value = res.data;
        usingTestTree.value = false;
      } else {
        nodes.value = [];
        console.warn('Fetched nodes data is not an array:', res.data);
      }
    } catch (error) {
      console.error('Failed to fetch nodes:', error);
      ElMessage.error('无法连接到服务器，请检查后端服务是否启动。');
    } finally {
      loading.value = false;
    }
  }

  async function askQuestion(question: string, parentId?: string, context?: string) {
    loading.value = true;
    try {
      const res = await createNode({ question, parentId, sessionId: sessionId.value, context });
      const newNode = res.data;
      usingTestTree.value = false;
      
      nodes.value.push(newNode);
      currentChatHistory.value.push(newNode);
      selectedNodeId.value = newNode._id;
      
      try {
        await memoryTree.addNode(newNode, {
          question,
          parentId,
          sessionId: sessionId.value,
          context
        });
      } catch (err: unknown) {
        console.warn('Failed to save to memory tree', err);
      }
      
      return newNode;
    } catch (error) {
      console.error('Failed to ask question:', error);
      throw error;
    } finally {
      loading.value = false;
    }
  }

  async function restoreSession(nodeId: string) {
    selectedNodeId.value = nodeId;
    const path: KnowledgeNode[] = [];
    let current: KnowledgeNode | undefined = nodes.value.find(n => n._id === nodeId);
    
    while (current) {
      path.unshift(current);
      if (current.parentId) {
        current = nodes.value.find(n => n._id === current!.parentId);
      } else {
        current = undefined;
      }
    }
    
    currentChatHistory.value = path;
  }

  async function restoreContext(nodeId: string) {
    try {
      return await memoryTree.restoreContext(nodeId);
    } catch (err: unknown) {
      console.error('Failed to restore context', err);
      ElMessage.warning('无法恢复该节点的上下文历史');
      return null;
    }
  }

  async function deleteNode(id: string) {
    loading.value = true;
    try {
      const deleteLocalOnly = usingTestTree.value || isTestTreeNode(id);
      if (deleteLocalOnly) {
        const deleteSet = new Set<string>();
        const queue = [id];
        while (queue.length) {
          const currentId = queue.shift();
          if (!currentId || deleteSet.has(currentId)) continue;
          deleteSet.add(currentId);
          nodes.value
            .filter(node => node.parentId === currentId)
            .forEach(node => queue.push(node._id));
        }
        nodes.value = nodes.value.filter(node => !deleteSet.has(node._id));
        usingTestTree.value = nodes.value.some(node => isTestTreeNode(node._id));
      } else {
        await apiDeleteNode(id);
        await fetchNodes();
      }
      
      if (selectedNodeId.value === id || !nodes.value.find(n => n._id === selectedNodeId.value)) {
        selectedNodeId.value = null;
        currentChatHistory.value = [];
      }
      
      ElMessage.success('节点删除成功');
    } catch (error) {
      console.error('Failed to delete node:', error);
      ElMessage.error('删除节点失败');
      throw error;
    } finally {
      loading.value = false;
    }
  }

  function generateTestTree() {
    const newNodes = generateTestTreeNodes({
      sessionId: sessionId.value,
      maxLevel: 10,
      branchCount: 2
    });
    
    nodes.value = newNodes;
    usingTestTree.value = true;
    const rootNode = newNodes[0];
    if (rootNode) {
      currentChatHistory.value = [rootNode];
      selectedNodeId.value = rootNode._id;
    } else {
      currentChatHistory.value = [];
      selectedNodeId.value = null;
    }
  }

  const treeData = computed(() => buildTree(nodes.value, sessionId.value));

  return { 
    nodes, 
    currentChatHistory, 
    selectedNodeId, 
    sessionId, 
    loading, 
    fetchNodes, 
    askQuestion, 
    restoreContext, 
    restoreSession, 
    generateTestTree, 
    deleteNode, 
    treeData 
  };
});
