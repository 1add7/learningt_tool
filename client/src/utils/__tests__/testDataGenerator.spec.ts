import { describe, it, expect } from 'vitest';
import { generateTestTree } from '../testDataGenerator';

describe('testDataGenerator', () => {
  it('should generate test tree with default options', () => {
    const nodes = generateTestTree({
      sessionId: 'test-session'
    });

    expect(nodes.length).toBeGreaterThan(0);
    expect(nodes[0].question).toBe('Root Node (Level 0)');
    expect(nodes[0].sessionId).toBe('test-session');
    expect(nodes[0].level).toBe(0);
  });

  it('should generate test tree with custom max level', () => {
    const nodes = generateTestTree({
      sessionId: 'test-session',
      maxLevel: 3
    });

    const maxLevel = Math.max(...nodes.map(n => n.level || 0));
    expect(maxLevel).toBe(3);
  });

  it('should generate test tree with custom branch count', () => {
    const nodes = generateTestTree({
      sessionId: 'test-session',
      maxLevel: 2,
      branchCount: 3
    });

    expect(nodes.length).toBeGreaterThan(0);
  });

  it('should generate nodes with correct parent-child relationships', () => {
    const nodes = generateTestTree({
      sessionId: 'test-session',
      maxLevel: 2
    });

    const childNodes = nodes.filter(n => n.parentId);
    childNodes.forEach(node => {
      const parent = nodes.find(n => n._id === node.parentId);
      expect(parent).toBeDefined();
    });
  });

  it('should generate nodes with unique IDs', () => {
    const nodes = generateTestTree({
      sessionId: 'test-session'
    });

    const ids = nodes.map(n => n._id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should generate nodes with required properties', () => {
    const nodes = generateTestTree({
      sessionId: 'test-session'
    });

    nodes.forEach(node => {
      expect(node._id).toBeDefined();
      expect(node.question).toBeDefined();
      expect(node.answer).toBeDefined();
      expect(node.sessionId).toBe('test-session');
      expect(node.createdAt).toBeDefined();
    });
  });
});
