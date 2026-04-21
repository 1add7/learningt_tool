import { describe, it, expect } from 'vitest';
import { buildTree } from '../treeBuilder';
import type { KnowledgeNode } from '../../types';

describe('treeBuilder', () => {
  it('should return empty array for empty input', () => {
    const result = buildTree([], 'test-session');
    expect(result).toEqual([]);
  });

  it('should build tree with single root node', () => {
    const nodes: KnowledgeNode[] = [
      {
        _id: 'root-1',
        question: 'Root Question',
        answer: 'Root Answer',
        sessionId: 'test-session',
        createdAt: '2024-01-01T00:00:00.000Z'
      }
    ];

    const result = buildTree(nodes, 'test-session');
    
    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe('root-1');
    expect(result[0].question).toBe('Root Question');
    expect(result[0].level).toBe(0);
    expect(result[0].children).toEqual([]);
  });

  it('should build tree with parent-child relationship', () => {
    const nodes: KnowledgeNode[] = [
      {
        _id: 'parent-1',
        question: 'Parent Question',
        answer: 'Parent Answer',
        sessionId: 'test-session',
        createdAt: '2024-01-01T00:00:00.000Z'
      },
      {
        _id: 'child-1',
        question: 'Child Question',
        answer: 'Child Answer',
        parentId: 'parent-1',
        sessionId: 'test-session',
        createdAt: '2024-01-01T01:00:00.000Z'
      }
    ];

    const result = buildTree(nodes, 'test-session');
    
    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe('parent-1');
    expect(result[0].children).toHaveLength(1);
    expect(result[0].children[0]._id).toBe('child-1');
    expect(result[0].children[0].level).toBe(1);
  });

  it('should create virtual root for multiple root nodes', () => {
    const nodes: KnowledgeNode[] = [
      {
        _id: 'root-1',
        question: 'Root 1',
        answer: 'Answer 1',
        sessionId: 'test-session',
        createdAt: '2024-01-01T00:00:00.000Z'
      },
      {
        _id: 'root-2',
        question: 'Root 2',
        answer: 'Answer 2',
        sessionId: 'test-session',
        createdAt: '2024-01-01T01:00:00.000Z'
      }
    ];

    const result = buildTree(nodes, 'test-session');
    
    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe('root');
    expect(result[0].question).toBe('知识根节点');
    expect(result[0].children).toHaveLength(2);
    expect(result[0].level).toBe(-1);
  });

  it('should set correct levels for nested nodes', () => {
    const nodes: KnowledgeNode[] = [
      {
        _id: 'level-0',
        question: 'Level 0',
        answer: 'Answer 0',
        sessionId: 'test-session',
        createdAt: '2024-01-01T00:00:00.000Z'
      },
      {
        _id: 'level-1',
        question: 'Level 1',
        answer: 'Answer 1',
        parentId: 'level-0',
        sessionId: 'test-session',
        createdAt: '2024-01-01T01:00:00.000Z'
      },
      {
        _id: 'level-2',
        question: 'Level 2',
        answer: 'Answer 2',
        parentId: 'level-1',
        sessionId: 'test-session',
        createdAt: '2024-01-01T02:00:00.000Z'
      }
    ];

    const result = buildTree(nodes, 'test-session');
    
    expect(result[0].level).toBe(0);
    expect(result[0].children[0].level).toBe(1);
    expect(result[0].children[0].children[0].level).toBe(2);
  });
});
