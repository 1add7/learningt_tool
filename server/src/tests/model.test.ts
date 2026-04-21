import test from 'node:test';
import assert from 'node:assert';
import mongoose from 'mongoose';
import KnowledgeNode from '../models/KnowledgeNode.js';

// Mock mongoose connection (not really needed for schema validation but good practice)
// Actually we can just validate the schema structure or create a doc in memory (without saving)

test('KnowledgeNode Model Validation', async (t) => {
  await t.test('should validate a valid node', () => {
    const node = new KnowledgeNode({
      question: 'What is Vue?',
      answer: 'Vue is a framework.',
      sessionId: 'test-session',
    });
    
    const err = node.validateSync();
    assert.strictEqual(err, undefined);
    assert.strictEqual(node.question, 'What is Vue?');
  });

  await t.test('should require question and answer', () => {
    const node = new KnowledgeNode({
      sessionId: 'test-session',
    });
    
    const err = node.validateSync();
    assert.ok(err);
    assert.ok(err.errors['question']);
    assert.ok(err.errors['answer']);
  });
});
