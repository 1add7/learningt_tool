import express from "express";
import { runAgent } from "../services/agentService.js";
import * as knowledgeService from "../services/knowledgeService.js";
import {
  indexNodeEmbedding,
  reindexMissingEmbeddings,
} from "../services/retrievalService.js";

const router = express.Router();

/** 异步建立向量索引，失败不影响主流程。 */
const scheduleIndexing = (node: any) => {
  void indexNodeEmbedding(node).catch((error: any) => {
    console.error("[RAG] 节点索引失败:", error.message);
  });
};

/**
 * 组装传给模型的上下文：
 * 用户显式选中了片段就用它；只给了父节点则回退为「父节点答案」。
 */
const buildContext = async (
  parentId?: string,
  context?: string,
): Promise<string> => {
  let llmContext = context || "";
  if (parentId && !context) {
    const parent = await knowledgeService.findNodeById(parentId);
    if (parent) {
      llmContext = `Previous answer: ${parent.answer}\n\n${llmContext}`;
    }
  }
  return llmContext;
};

// POST /api/chat - 非流式，走同一套 Agent 逻辑
router.post("/chat", async (req, res) => {
  try {
    const { question, parentId, sessionId, context } = req.body;

    if (!question || !sessionId) {
      return res
        .status(400)
        .json({ error: "Question and Session ID are required" });
    }

    const llmContext = await buildContext(parentId, context);

    const result = await runAgent({
      question,
      context: llmContext,
      sessionId,
      emit: () => {},
    });

    const node = await knowledgeService.createNode({
      question,
      answer: result.answer,
      parentId: parentId || null,
      sessionId,
      context: context || null,
      citations: result.citations,
    });

    scheduleIndexing(node);

    res.status(201).json(node);
  } catch (error: any) {
    console.error("Error in /chat:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/chat/stream - SSE 流式输出 Agent 的完整执行过程
router.post("/chat/stream", async (req, res) => {
  const { question, parentId, sessionId, context } = req.body;

  if (!question || !sessionId) {
    return res
      .status(400)
      .json({ error: "Question and Session ID are required" });
  }

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (payload: unknown) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  // 心跳保活：避免长推理期间被反向代理掐断连接
  const heartbeat = setInterval(() => {
    res.write(": ping\n\n");
  }, 15000);

  try {
    const llmContext = await buildContext(parentId, context);

    const result = await runAgent({
      question,
      context: llmContext,
      sessionId,
      emit: (event) => send(event),
    });

    const node = await knowledgeService.createNode({
      question,
      answer: result.answer,
      parentId: parentId || null,
      sessionId,
      context: context || null,
      citations: result.citations,
    });

    scheduleIndexing(node);

    send({
      type: "done",
      node,
      iterations: result.iterations,
      usedAgent: result.usedAgent,
    });
  } catch (error: any) {
    console.error("Error in /chat/stream:", error);
    send({ type: "error", message: error.message });
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
});

// POST /api/admin/reindex - 为存量节点补建向量索引（开启 RAG 后处理老数据）
router.post("/admin/reindex", async (_req, res) => {
  try {
    const indexed = await reindexMissingEmbeddings();
    res.json({ indexed });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /nodes/:sessionId - Get all nodes for a session (flat list)
router.get("/nodes/:sessionId", async (req, res) => {
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
router.delete("/nodes/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await knowledgeService.deleteNodeRecursively(id);
    res.json({ message: "Node and descendants deleted" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
