import KnowledgeNode, { type IKnowledgeNode } from "../models/KnowledgeNode.js";
import mongoose from "mongoose";

// In-memory store for fallback
let memoryStore: any[] = [];
let useMemory = false;

export const setUseMemory = (val: boolean) => {
  useMemory = val;
  if (useMemory) {
    console.log("Using in-memory database fallback");
  }
};

// 1 = connected。未连接时也走内存，避免 mongoose 在 disconnected 状态下抛错。
const shouldUseMemory = () => useMemory || mongoose.connection.readyState !== 1;

export const createNode = async (data: any) => {
  if (shouldUseMemory()) {
    const newNode = {
      _id: new mongoose.Types.ObjectId(),
      ...data,
      parentId: data.parentId
        ? new mongoose.Types.ObjectId(data.parentId)
        : null,
      createdAt: new Date(),
      citations: data.citations ?? [],
      __v: 0,
    };
    memoryStore.push(newNode);
    return newNode;
  }

  const node = new KnowledgeNode(data);
  return await node.save();
};

export const findNodeById = async (id: string) => {
  if (shouldUseMemory()) {
    return memoryStore.find((n) => n._id.toString() === id) || null;
  }
  return await KnowledgeNode.findById(id);
};

export const findNodesBySession = async (sessionId: string) => {
  if (shouldUseMemory()) {
    return memoryStore
      .filter((n) => n.sessionId === sessionId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
  return await KnowledgeNode.find({ sessionId }).sort({ createdAt: 1 });
};

export const findChildren = async (parentId: string) => {
  if (shouldUseMemory()) {
    return memoryStore.filter(
      (n) => n.parentId && n.parentId.toString() === parentId,
    );
  }
  return await KnowledgeNode.find({ parentId });
};

export const deleteNode = async (id: string) => {
  if (shouldUseMemory()) {
    const index = memoryStore.findIndex((n) => n._id.toString() === id);
    if (index !== -1) {
      memoryStore.splice(index, 1);
      return true;
    }
    return false;
  }
  return await KnowledgeNode.findByIdAndDelete(id);
};

// Helper for recursive delete
export const deleteNodeRecursively = async (id: string) => {
  const children = await findChildren(id);
  for (const child of children) {
    await deleteNodeRecursively(child._id.toString());
  }
  await deleteNode(id);
};

/** 写入节点的向量表示。 */
export const updateNodeEmbedding = async (
  id: string,
  embedding: number[],
  embeddingModel: string,
) => {
  if (shouldUseMemory()) {
    const node = memoryStore.find((n) => n._id.toString() === id);
    if (node) {
      node.embedding = embedding;
      node.embeddingModel = embeddingModel;
      node.embeddedAt = new Date();
    }
    return true;
  }

  await KnowledgeNode.findByIdAndUpdate(id, {
    embedding,
    embeddingModel,
    embeddedAt: new Date(),
  });
  return true;
};

/**
 * 取出可用于检索的候选节点。
 * 传入 sessionId 时只在该会话内检索（默认行为，与「会话即知识域」的产品模型一致）。
 */
export const findSearchCandidates = async (sessionId?: string) => {
  if (shouldUseMemory()) {
    return memoryStore.filter((n) => !sessionId || n.sessionId === sessionId);
  }
  return await KnowledgeNode.find(sessionId ? { sessionId } : {});
};

/** 沿 parentId 向上回溯，返回 根 → 当前 的顺序。 */
export const findAncestorChain = async (id: string, maxDepth = 5) => {
  const chain: any[] = [];
  let cursor: any = await findNodeById(id);
  let depth = 0;

  while (cursor && depth < maxDepth) {
    chain.unshift(cursor);
    const parentId = cursor.parentId ? cursor.parentId.toString() : null;
    if (!parentId) break;
    cursor = await findNodeById(parentId);
    depth += 1;
  }

  return chain;
};

/** 找出还没有向量索引的节点 ID，用于补建索引。 */
export const findUnindexedNodeIds = async (limit: number) => {
  if (shouldUseMemory()) {
    return memoryStore
      .filter((n) => !Array.isArray(n.embedding) || n.embedding.length === 0)
      .slice(0, limit)
      .map((n) => n._id.toString());
  }

  const nodes = await KnowledgeNode.find({
    $or: [
      { embedding: { $exists: false } },
      { embedding: { $size: 0 } },
    ],
  }).limit(limit);

  return nodes.map((node) => node._id.toString());
};

export type { IKnowledgeNode };
