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
