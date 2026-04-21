import express from 'express';
import { generateAnswer } from '../services/llmService.js';
import * as knowledgeService from '../services/knowledgeService.js';

const router = express.Router();

// POST /api/chat - Create a new question node
router.post('/chat', async (req, res) => {
  try {
    const { question, parentId, sessionId, context } = req.body;

    if (!question || !sessionId) {
      return res.status(400).json({ error: 'Question and Session ID are required' });
    }

    // Prepare context for LLM
    let llmContext = context || '';
    if (parentId && !context) {
      // If parent exists but no specific context selected, maybe fetch parent's answer?
      // For now, assume context is passed explicitly if it's a "selection"
      // If just a follow-up without selection, maybe we should include parent answer as context.
      const parent = await knowledgeService.findNodeById(parentId);
      if (parent) {
        llmContext = `Previous answer: ${parent.answer}\n\n${llmContext}`;
      }
    }

    // Call LLM
    const answer = await generateAnswer(question, llmContext);

    // Save to DB (or memory)
    const node = await knowledgeService.createNode({
      question,
      answer,
      parentId: parentId || null,
      sessionId,
      context: context || null
    });

    res.status(201).json(node);
  } catch (error: any) {
    console.error('Error in /chat:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /nodes/:sessionId - Get all nodes for a session (flat list)
router.get('/nodes/:sessionId', async (req, res) => {
  console.log(`[API] GET /nodes/${req.params.sessionId} requested`);
  try {
    const { sessionId } = req.params;
    const nodes = await knowledgeService.findNodesBySession(sessionId);
    console.log(`[API] Found ${nodes.length} nodes for session ${sessionId}`);
    res.json(nodes);
  } catch (error: any) {
    console.error(`[API] Error fetching nodes: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /nodes/:id - Delete a node and its children (cascade)
router.delete('/nodes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await knowledgeService.deleteNodeRecursively(id);
    res.json({ message: 'Node and descendants deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
