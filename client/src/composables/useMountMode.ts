import { ref, computed, type Ref } from 'vue';
import { useKnowledgeStore } from '../stores/knowledge';
import type { ContextItem } from './useContext';

export type MountMode = 'followup' | 'context-anchor';

export function useMountMode(selectedContexts: Ref<ContextItem[]>) {
  const store = useKnowledgeStore();
  const askMode = ref<MountMode>('followup');

  const buildNodeChain = (nodeId: string) => {
    const chain: string[] = [];
    let cursor = store.nodes.find(n => n._id === nodeId);
    while (cursor) {
      chain.unshift(cursor._id);
      const parentId = cursor.parentId;
      if (!parentId) break;
      cursor = store.nodes.find(n => n._id === parentId);
    }
    return chain;
  };

  const findCommonAncestor = (nodeIds: string[]) => {
    if (nodeIds.length === 0) return undefined;
    if (nodeIds.length === 1) return nodeIds[0];

    const chains = nodeIds.map(id => buildNodeChain(id));
    let index = 0;
    let lastCommon = '';

    while (true) {
      const current = chains[0]?.[index];
      if (!current) break;
      if (chains.every(chain => chain[index] === current)) {
        lastCommon = current;
        index += 1;
        continue;
      }
      break;
    }

    return lastCommon || nodeIds[0];
  };

  const anchorTargetNodeId = computed(() => {
    if (askMode.value !== 'context-anchor') return null;
    const uniqueIds = [...new Set(selectedContexts.value.map(item => item.sourceNodeId))];
    return findCommonAncestor(uniqueIds) || null;
  });

  const anchorTargetNode = computed(() => {
    if (!anchorTargetNodeId.value) return null;
    return store.nodes.find(node => node._id === anchorTargetNodeId.value) || null;
  });

  return {
    askMode,
    anchorTargetNodeId,
    anchorTargetNode
  };
}
