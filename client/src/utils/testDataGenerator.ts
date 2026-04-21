import type { KnowledgeNode } from '../types';

export interface TestTreeOptions {
  sessionId: string;
  maxLevel?: number;
  branchCount?: number;
}

export function generateTestTree(options: TestTreeOptions): KnowledgeNode[] {
  const { sessionId, maxLevel = 10, branchCount = 2 } = options;
  const newNodes: KnowledgeNode[] = [];
  const seed = Date.now().toString(36);
  const rootId = 'root-test-' + seed;

  newNodes.push({
    _id: rootId,
    question: 'Root Node (Level 0)',
    answer: 'Root Answer',
    sessionId,
    createdAt: new Date().toISOString(),
    level: 0
  });

  let parents = [rootId];

  for (let i = 1; i <= maxLevel; i++) {
    const nextParents: string[] = [];

    parents.forEach((pid, index) => {
      const count = index === 0 ? branchCount : 1;

      for (let j = 0; j < count; j++) {
        const id = `node-${seed}-${i}-${index}-${j}`;
        newNodes.push({
          _id: id,
          question: `Level ${i} Node ${j} (Long text to test truncation behavior)`,
          answer: `Answer for level ${i}`,
          parentId: pid,
          sessionId,
          createdAt: new Date().toISOString(),
          level: i
        });
        nextParents.push(id);
      }
    });
    parents = nextParents;
  }

  return newNodes;
}
