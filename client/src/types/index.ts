export interface KnowledgeNode {
  _id: string;
  question: string;
  answer: string;
  context?: string;
  parentId?: string;
  sessionId: string;
  createdAt: string;
  level: number; // Hierarchical level (0 for root)
  children?: KnowledgeNode[]; // For tree structure visualization
}
