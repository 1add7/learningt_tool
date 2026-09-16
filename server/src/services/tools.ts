import axios from "axios";
import type { ChatTool } from "./chatClient.js";
import * as knowledgeService from "./knowledgeService.js";
import { searchKnowledge, type RetrievedNode } from "./retrievalService.js";

export interface Citation {
  nodeId: string;
  question: string;
  score: number;
  mode: string;
}

export interface ToolResult {
  content: string;
  citations: Citation[];
  failed: boolean;
}

export interface ToolExecutionContext {
  sessionId: string;
}

const truncate = (text: string, max: number) =>
  text.length <= max ? text : `${text.slice(0, max)}……`;

const toCitations = (items: RetrievedNode[]): Citation[] =>
  items.map((item) => ({
    nodeId: item.id,
    question: item.question,
    score: Number(item.score.toFixed(4)),
    mode: item.mode,
  }));

const readString = (
  args: Record<string, unknown>,
  key: string,
): string | null => {
  const value = args[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

const readNumber = (
  args: Record<string, unknown>,
  key: string,
  fallback: number,
  min: number,
  max: number,
): number => {
  const value = args[key];
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
};

export const agentTools: ChatTool[] = [
  {
    type: "function",
    function: {
      name: "search_knowledge_tree",
      description:
        "在用户已有的知识树中做语义检索，返回最相关的问答节点（含节点ID、问题、答案摘要与相关度）。当用户的问题可能与此前积累的学习内容相关，或需要引用历史结论时，优先调用本工具。",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "检索用的自然语言查询，尽量保留用户问题中的关键概念，不要加无关修饰",
          },
          top_k: {
            type: "integer",
            description: "返回的节点数量，默认 4，范围 1-10",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_node_context",
      description:
        "获取指定节点的上下文链路，包含它的祖先节点（父节点、祖父节点……）。当你通过 search_knowledge_tree 拿到节点ID后，需要理解这个节点的来龙去脉、或它属于哪条学习主线时调用。",
      parameters: {
        type: "object",
        properties: {
          node_id: {
            type: "string",
            description: "目标节点ID，来自 search_knowledge_tree 的返回结果",
          },
          depth: {
            type: "integer",
            description: "向上回溯的层数，默认 3，范围 1-5",
          },
        },
        required: ["node_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "联网搜索最新信息。仅当知识树中没有相关内容，或问题涉及实时、外部信息（如最新版本、新闻、时效性数据）时使用。",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "搜索关键词" },
        },
        required: ["query"],
      },
    },
  },
];

async function searchKnowledgeTree(
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const query = readString(args, "query");
  if (!query) {
    return { content: "缺少 query 参数。", citations: [], failed: true };
  }

  const topK = readNumber(args, "top_k", 4, 1, 10);
  const results = await searchKnowledge(query, {
    sessionId: context.sessionId,
    topK,
  });

  if (results.length === 0) {
    return {
      content: `知识树中没有检索到与「${query}」相关的节点。可以尝试换用更贴近用户原话的关键词，或改用 web_search。`,
      citations: [],
      failed: false,
    };
  }

  const content = results
    .map(
      (item, index) =>
        `[${index + 1}] 节点ID: ${item.id}\n问题: ${item.question}\n答案摘要: ${truncate(item.answer, 400)}\n相关度: ${item.score.toFixed(3)}（${item.mode === "vector" ? "向量检索" : "关键词检索"}）`,
    )
    .join("\n\n");

  return { content, citations: toCitations(results), failed: false };
}

async function getNodeContext(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const nodeId = readString(args, "node_id");
  if (!nodeId) {
    return { content: "缺少 node_id 参数。", citations: [], failed: true };
  }

  const depth = readNumber(args, "depth", 3, 1, 5);
  const chain = await knowledgeService.findAncestorChain(nodeId, depth);

  if (chain.length === 0) {
    return {
      content: `未找到节点 ${nodeId}，请确认节点ID是否来自 search_knowledge_tree 的返回结果。`,
      citations: [],
      failed: true,
    };
  }

  const content = chain
    .map((node: any, index: number) => {
      const label = index === chain.length - 1 ? "目标节点" : `第 ${index + 1} 层祖先`;
      return `--- ${label} ---\n节点ID: ${node._id.toString()}\n问题: ${node.question}\n答案: ${truncate(node.answer ?? "", 300)}`;
    })
    .join("\n\n");

  const citations: Citation[] = chain.map((node: any) => ({
    nodeId: node._id.toString(),
    question: node.question ?? "",
    score: 1,
    mode: "context",
  }));

  return { content, citations, failed: false };
}

async function webSearch(args: Record<string, unknown>): Promise<ToolResult> {
  const query = readString(args, "query");
  if (!query) {
    return { content: "缺少 query 参数。", citations: [], failed: true };
  }

  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return {
      content:
        "联网搜索当前不可用：服务端未配置 TAVILY_API_KEY。请基于知识树内容或你已有的知识作答，并明确告知用户无法获取实时信息。",
      citations: [],
      failed: true,
    };
  }

  try {
    const response = await axios.post(
      "https://api.tavily.com/search",
      {
        api_key: apiKey,
        query,
        max_results: 5,
        search_depth: "basic",
      },
      { timeout: 20000 },
    );

    const results: any[] = response.data?.results ?? [];
    if (results.length === 0) {
      return { content: `联网搜索「${query}」没有返回结果。`, citations: [], failed: false };
    }

    const content = results
      .map(
        (item, index) =>
          `[${index + 1}] ${item.title ?? "无标题"}\n${item.url ?? ""}\n${truncate(item.content ?? "", 300)}`,
      )
      .join("\n\n");

    return { content, citations: [], failed: false };
  } catch (error: any) {
    return {
      content: `联网搜索失败: ${error.response?.data?.detail ?? error.message}`,
      citations: [],
      failed: true,
    };
  }
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  switch (name) {
    case "search_knowledge_tree":
      return searchKnowledgeTree(args, context);
    case "get_node_context":
      return getNodeContext(args);
    case "web_search":
      return webSearch(args);
    default:
      return {
        content: `未知工具: ${name}`,
        citations: [],
        failed: true,
      };
  }
}
