import api from '../utils/axios';
import type { KnowledgeNode } from '../types';

export const getNodes = (sessionId: string) => api.get<KnowledgeNode[]>(`/nodes/${sessionId}`);

export const createNode = (data: { question: string, parentId?: string, sessionId: string, context?: string }) => 
  api.post<KnowledgeNode>('/chat', data);

export const deleteNode = (id: string) => api.delete(`/nodes/${id}`);
