import dotenv from "dotenv";
import {
  chatRound,
  isToolCallingAvailable,
  type ChatMessage,
} from "./chatClient.js";
import { generateAnswer } from "./llmService.js";
import {
  searchKnowledge,
  type RetrievedNode,
} from "./retrievalService.js";
import { agentTools, executeTool, type Citation } from "./tools.js";

dotenv.config();

/**
 * Agent 向前端下发的事件协议。
 *
 * 一轮（round）的生命周期：
 *   round_start → token* → round_end(kind)
 * 其中 kind 为 'thinking' 表示这一轮模型决定调用工具（token 属于思考过程），
 * 为 'final' 表示这一轮就是最终回答。前端据此决定 token 归入思考区还是回答区。
 */
export type AgentEvent =
  | { type: "status"; message: string }
  | { type: "round_start"; iteration: number }
  | { type: "token"; content: string }
  | { type: "round_end"; iteration: number; kind: "thinking" | "final" }
  | {
      type: "action";
      id: string;
      tool: string;
      args: Record<string, unknown>;
      iteration: number;
    }
  | {
      type: "observation";
      id: string;
      tool: string;
      ok: boolean;
      content: string;
      iteration: number;
    }
  | { type: "citations"; items: Citation[] };

export type AgentEventEmitter = (event: AgentEvent) => void;

export interface AgentRunResult {
  answer: string;
  citations: Citation[];
  iterations: number;
  usedAgent: boolean;
}

const AGENT_ENABLED =
  (process.env.AGENT_ENABLED ?? "true").toLowerCase() !== "false";
const MAX_ITERATIONS = Math.max(
  1,
  Number(process.env.AGENT_MAX_ITERATIONS || 5),
);
const PRERETRIEVE =
  (process.env.RAG_PRERETRIEVE ?? "true").toLowerCase() !== "false";

const AGENT_SYSTEM_PROMPT = `你是「AI 学习树」中的知识 Agent。你的任务是基于用户已有的知识积累来回答问题，必要时主动调用工具获取信息。

工作原则：
1. 回答任何可能与用户历史学习内容相关的问题前，先调用 search_knowledge_tree 检索知识树，不要凭空作答。
2. 如果检索到的片段信息不完整，调用 get_node_context 获取该节点的祖先链路，理解它在整条学习主线中的位置。
3. 只有知识树中确实没有相关内容、或问题涉及实时/外部信息时，才调用 web_search。
4. 工具调用轮次有限，请合并检索意图，避免用相近的查询重复调用同一个工具。
5. 最终回答使用中文，结构清晰、简洁准确。
6. 若引用了知识树中的节点，请在对应句子末尾用 [1]、[2] 这样的编号标注来源，编号与 search_knowledge_tree 返回结果的序号一致。
7. 如果工具返回的信息不足以回答问题，请直接说明缺少什么信息，不要编造。`;

const truncate = (text: string, max: number) =>
  text.length <= max ? text : `${text.slice(0, max)}……`;

const parseArguments = (raw: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
};

const mergeCitations = (target: Citation[], incoming: Citation[]) => {
  const map = new Map<string, Citation>();
  for (const item of [...target, ...incoming]) {
    const existing = map.get(item.nodeId);
    if (!existing || item.score > existing.score) map.set(item.nodeId, item);
  }
  target.length = 0;
  target.push(...[...map.values()].sort((a, b) => b.score - a.score));
};

const toCitations = (items: RetrievedNode[]): Citation[] =>
  items.map((item) => ({
    nodeId: item.id,
    question: item.question,
    score: Number(item.score.toFixed(4)),
    mode: item.mode,
  }));

interface RunParams {
  question: string;
  context?: string | undefined;
  sessionId: string;
  emit: AgentEventEmitter;
}

async function runAgentLoop(
  params: RunParams,
  citations: Citation[],
): Promise<AgentRunResult> {
  const { question, context, sessionId, emit } = params;

  const messages: ChatMessage[] = [
    { role: "system", content: AGENT_SYSTEM_PROMPT },
  ];
  messages.push({
    role: "user",
    content: context
      ? `用户选中的上下文片段：\n${context}\n\n用户的问题：${question}`
      : question,
  });

  let answer = "";
  let iteration = 0;

  while (iteration < MAX_ITERATIONS) {
    iteration += 1;
    emit({ type: "round_start", iteration });

    const round = await chatRound(messages, agentTools, (token) =>
      emit({ type: "token", content: token }),
    );

    const hasToolCalls = round.toolCalls.length > 0;
    emit({
      type: "round_end",
      iteration,
      kind: hasToolCalls ? "thinking" : "final",
    });

    if (!hasToolCalls) {
      answer = round.content;
      break;
    }

    messages.push({
      role: "assistant",
      content: round.content,
      tool_calls: round.toolCalls,
    });

    for (const call of round.toolCalls) {
      const toolName = call.function.name;
      const args = parseArguments(call.function.arguments);
      emit({ type: "action", id: call.id, tool: toolName, args, iteration });

      const result = await executeTool(toolName, args, { sessionId });

      emit({
        type: "observation",
        id: call.id,
        tool: toolName,
        ok: !result.failed,
        content: truncate(result.content, 600),
        iteration,
      });

      if (result.citations.length > 0) {
        mergeCitations(citations, result.citations);
        emit({ type: "citations", items: [...citations] });
      }

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: result.content,
      });
    }
  }

  // 达到最大轮次仍未收敛：撤掉工具，强制模型给出最终回答
  if (!answer) {
    emit({
      type: "status",
      message: `已达到最大推理轮次（${MAX_ITERATIONS}），正在基于已获取的信息生成最终回答…`,
    });
    iteration += 1;
    emit({ type: "round_start", iteration });
    messages.push({
      role: "user",
      content: "请立刻基于以上已获取的信息给出最终回答，不要再调用任何工具。",
    });

    const finalRound = await chatRound(messages, [], (token) =>
      emit({ type: "token", content: token }),
    );
    emit({ type: "round_end", iteration, kind: "final" });
    answer = finalRound.content;
  }

  return { answer, citations, iterations: iteration, usedAgent: true };
}

/**
 * 降级路径：模型不支持工具调用（Ollama / 未配置 Key）时，
 * 改为「先检索知识树 → 把召回内容注入上下文 → 单轮问答」。
 */
async function runFallback(
  params: RunParams,
  citations: Citation[],
): Promise<AgentRunResult> {
  const { question, context, sessionId, emit } = params;

  emit({
    type: "status",
    message: "当前模型不支持工具调用，已降级为「检索增强问答」",
  });

  let retrieved: RetrievedNode[] = [];
  if (PRERETRIEVE) {
    retrieved = await searchKnowledge(question, { sessionId });
    if (retrieved.length > 0) {
      mergeCitations(citations, toCitations(retrieved));
      emit({ type: "citations", items: [...citations] });
    }
  }

  const blocks: string[] = [];
  if (retrieved.length > 0) {
    blocks.push(
      `以下是知识树中检索到的相关历史笔记：\n${retrieved
        .map(
          (item, index) =>
            `[${index + 1}] ${item.question}\n${truncate(item.answer, 400)}`,
        )
        .join("\n\n")}`,
    );
  }
  if (context) {
    blocks.push(`用户选中的上下文片段：\n${context}`);
  }

  emit({ type: "round_start", iteration: 1 });
  const answer = await generateAnswer(
    question,
    blocks.length > 0 ? blocks.join("\n\n") : undefined,
  );
  emit({ type: "token", content: answer });
  emit({ type: "round_end", iteration: 1, kind: "final" });

  return { answer, citations, iterations: 1, usedAgent: false };
}

export async function runAgent(params: RunParams): Promise<AgentRunResult> {
  const citations: Citation[] = [];

  if (!AGENT_ENABLED || !isToolCallingAvailable()) {
    return runFallback(params, citations);
  }

  try {
    return await runAgentLoop(params, citations);
  } catch (error: any) {
    const message = error?.message ?? String(error);
    console.error("[Agent] 执行失败，降级为检索增强问答:", message);
    // 先通知前端把已流式输出的片段归入「思考过程」，避免污染最终回答
    params.emit({ type: "status", message: `Agent 执行中断：${message}` });
    return runFallback(params, citations);
  }
}
