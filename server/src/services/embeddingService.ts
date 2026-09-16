import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "text-embedding-v3";
const EMBEDDING_ENABLED =
  (process.env.EMBEDDING_ENABLED ?? "true").toLowerCase() !== "false";

// text-embedding-v3 单次请求最多 10 条、单条最长 8192 token。
// 这里按字符数做保守截断，避免超出单条上限导致整个批次失败。
const MAX_BATCH_SIZE = 10;
const MAX_CHARS_PER_TEXT = 3000;

function getEmbeddingApiKey(): string | undefined {
  const key = process.env.EMBEDDING_API_KEY || process.env.QWEN_API_KEY;
  return key && key.trim() ? key.trim() : undefined;
}

function getCompatibleBaseUrl(): string {
  const base =
    process.env.QWEN_COMPATIBLE_BASE_URL ||
    "https://dashscope.aliyuncs.com/compatible-mode/v1";
  return base.replace(/\/+$/, "");
}

export const embeddingModelName = EMBEDDING_MODEL;

/**
 * 是否具备向量化能力。
 * 返回 false 时，调用方应降级为关键词检索。
 */
export function isEmbeddingEnabled(): boolean {
  return EMBEDDING_ENABLED && !!getEmbeddingApiKey();
}

/**
 * 批量把文本转换为向量，返回顺序与入参一致。
 * 返回 null 表示当前环境无法向量化（未开启 / 未配置 Key / 调用失败），调用方需降级。
 */
export async function embedTexts(
  texts: string[],
): Promise<number[][] | null> {
  const apiKey = getEmbeddingApiKey();
  if (!EMBEDDING_ENABLED || !apiKey || texts.length === 0) return null;

  const vectors: number[][] = [];

  try {
    for (let start = 0; start < texts.length; start += MAX_BATCH_SIZE) {
      const batch = texts
        .slice(start, start + MAX_BATCH_SIZE)
        .map(
          (text) =>
            text.replace(/\s+/g, " ").trim().slice(0, MAX_CHARS_PER_TEXT) || " ",
        );

      const response = await axios.post(
        `${getCompatibleBaseUrl()}/embeddings`,
        { model: EMBEDDING_MODEL, input: batch },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          timeout: 30000,
        },
      );

      const items: Array<{ index?: number; embedding?: number[] }> =
        response.data?.data ?? [];

      if (items.length !== batch.length) {
        console.error(
          `[Embedding] 返回条数不匹配: 期望 ${batch.length}, 实际 ${items.length}`,
        );
        return null;
      }

      // 按 index 排序，确保与入参顺序严格对应
      const ordered = [...items].sort(
        (a, b) => (a.index ?? 0) - (b.index ?? 0),
      );
      for (const item of ordered) {
        if (!Array.isArray(item.embedding)) return null;
        vectors.push(item.embedding);
      }
    }

    return vectors;
  } catch (error: any) {
    console.error(
      "[Embedding] 调用失败:",
      error.response?.data ?? error.message,
    );
    return null;
  }
}

/** 把单条文本转为向量，失败返回 null。 */
export async function embedText(text: string): Promise<number[] | null> {
  const vectors = await embedTexts([text]);
  return vectors?.[0] ?? null;
}
