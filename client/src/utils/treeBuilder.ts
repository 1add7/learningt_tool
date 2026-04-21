import type { KnowledgeNode } from '../types';

export interface TreeNode extends KnowledgeNode {
  children: TreeNode[];
  level: number;
}

export function buildTree(nodes: KnowledgeNode[], sessionId: string): TreeNode[] {
  if (!nodes.length) return [];

  const nodeMap = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  nodes.forEach(node => {
    nodeMap.set(node._id, { ...node, children: [], level: 0 });
  });

  nodes.forEach(node => {
    const mappedNode = nodeMap.get(node._id);
    if (!mappedNode) return;

    if (node.parentId && nodeMap.has(node.parentId)) {
      const parent = nodeMap.get(node.parentId);
      if (parent) {
        parent.children.push(mappedNode);
      }
    } else {
      roots.push(mappedNode);
    }
  });

  const queue = roots.map(root => ({ node: root, level: 0 }));
  
  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) continue;
    const { node, level } = item;
    node.level = level;
    
    if (node.children && node.children.length > 0) {
      node.children.forEach((child) => {
        queue.push({ node: child, level: level + 1 });
      });
    }
  }

  if (roots.length > 1) {
    return [{
      _id: 'root',
      question: '知识根节点',
      answer: '这是所有知识的起点',
      sessionId,
      createdAt: new Date().toISOString(),
      level: -1,
      children: roots
    }];
  }

  return roots;
}
