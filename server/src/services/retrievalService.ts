import {
  embedText,
  embedTexts,
  embeddingModelName,
  isEmbeddingEnabled,
} from "./embeddingService.js";
import * as knowledgeService from "./knowledgeService.js";

export interface RetrievedNode {
  id: string;
  question: string;
  answer: string;
  score: number;
  mode: "vector" | "keyword";
}

/** 余弦相似度。两个向量维度不一致时按较短的维度计算。 */
export function cosineSimilarity(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < length; i += 1) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * 中文友好的字符二元组集合。
 * 中文没有空格分词，用 bigram 做轻量近似，避免引入分词依赖。
 */
const buildBigrams = (text: string): Set<string> => {
  const normalized = text
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "");
  const grams = new Set<string>();

  for (let i = 0; i < normalized.length; i += 1) {
    grams.add(normalized.slice(i, i + 2));
  }
  if (grams.size === 0 && normalized) grams.add(normalized);

  return grams;
};

/** 关键词相似度：查询的 bigram 在文本中的命中比例，取值 0~1。 */
export function keywordSimilarity(query: string, text: string): number {
  const queryGrams = buildBigrams(query);
  if (queryGrams.size === 0) return 0;

  const textGrams = buildBigrams(text);
  let hit = 0;
  queryGrams.forEach((gram) => {
    if (textGrams.has(gram)) hit += 1;
  });

  return hit / queryGrams.size;
}

const getEmbedding = (node: any): number[] | null => {
  const raw = node?.embedding;
  if (!raw || typeof raw.length !== "number" || raw.length === 0) return null;
  return Array.from(raw as ArrayLike<number>);
};

/**
 * 知识树语义检索。
 * 优先走向量召回；当没有任何节点建过索引（或向量化不可用）时，自动降级为关键词检索。
 */
export async function searchKnowledge(
  query: string,
  options: { sessionId?: string; topK?: number; minScore?: number } = {},
): Promise<RetrievedNode[]> {
  const topK = options.topK ?? Number(process.env.RAG_TOP_K || 4);
  const minScore = options.minScore ?? Number(process.env.RAG_MIN_SCORE || 0.3);

  const candidates = await knowledgeService.findSearchCandidates(options.sessionId);
  if (candidates.length === 0) return [];

  const queryVector = isEmbeddingEnabled() ? await embedText(query) : null;

  if (queryVector) {
    const scored: RetrievedNode[] = [];
    for (const node of candidates) {
      const vector = getEmbedding(node);
      if (!vector || vector.length !== queryVector.length) continue;
      scored.push({
        id: node._id.toString(),
        question: node.question ?? "",
        answer: node.answer ?? "",
        score: cosineSimilarity(queryVector, vector),
        mode: "vector",
      });
    }

    if (scored.length > 0) {
      return scored
        .filter((item) => item.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
    }
  }

  // 降级：关键词检索
  return candidates
    .map((node) => {
      const text = `${node.question ?? ""} ${node.answer ?? ""}`;
      return {
        id: node._id.toString(),
        question: node.question ?? "",
        answer: node.answer ?? "",
        score: keywordSimilarity(query, text),
        mode: "keyword" as const,
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/** 为单个节点建立向量索引。 */
export async function indexNodeEmbedding(node: {
  _id: unknown;
  question?: string;
  answer?: string;
}): Promise<boolean> {
  if (!isEmbeddingEnabled()) return false;

  const text = `${node.question ?? ""}\n${node.answer ?? ""}`.trim();
  if (!text) return false;

  const vector = await embedText(text);
  if (!vector) return false;

  await knowledgeService.updateNodeEmbedding(
    String(node._id),
    vector,
    embeddingModelName,
  );
  return true;
}

/**
 * 为存量节点补建向量索引（用于老数据、或中途开启 RAG 的场景）。
 * 有总量上限，避免首次启动时产生大量调用。
 */
export async function reindexMissingEmbeddings(
  maxNodes = 300,
  batchSize = 10,
): Promise<number> {
  if (!isEmbeddingEnabled()) return 0;

  let indexed = 0;

  while (indexed < maxNodes) {
    const ids = await knowledgeService.findUnindexedNodeIds(batchSize);
    if (ids.length === 0) break;

    const nodes = (
      await Promise.all(ids.map((id) => knowledgeService.findNodeById(id)))
    ).filter((node): node is NonNullable<typeof node> => Boolean(node));
    if (nodes.length === 0) break;

    const vectors = await embedTexts(
      nodes.map((node) => `${node.question}\n${node.answer}`),
    );

    if (!vectors) {
      console.error("[RAG] 补建索引失败，已跳过本轮");
      break;
    }

    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i];
      const vector = vectors[i];
      if (!node || !vector) continue;
      await knowledgeService.updateNodeEmbedding(
        node._id.toString(),
        vector,
        embeddingModelName,
      );
      indexed += 1;
    }
  }

  return indexed;
}
