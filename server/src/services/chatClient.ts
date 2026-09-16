import dotenv from "dotenv";

dotenv.config();

/**
 * 基于 OpenAI 兼容协议的对话客户端。
 *
 * 只有走「兼容模式」的 Provider 才支持标准 Function Calling，
 * 因此 Agent 主循环只走这里；千问原生 endpoint（input.messages 结构）不支持 tools。
 * Ollama 走独立的原生协议，这里返回 null，由调用方降级处理。
 */

export interface ChatToolFunction {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ChatTool {
  type: "function";
  function: ChatToolFunction;
}

export interface ChatToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: ChatToolCall[];
  tool_call_id?: string;
}

export interface ChatRoundResult {
  content: string;
  toolCalls: ChatToolCall[];
}

interface EndpointConfig {
  url: string;
  apiKey: string;
  model: string;
}

function resolveEndpoint(): EndpointConfig | null {
  const provider = (process.env.LLM_PROVIDER || "qwen").toLowerCase();
  const model = process.env.LLM_MODEL || "qwen-plus";

  if (provider === "qwen") {
    const apiKey = process.env.QWEN_API_KEY;
    if (!apiKey) return null;
    const base = (
      process.env.QWEN_COMPATIBLE_BASE_URL ||
      "https://dashscope.aliyuncs.com/compatible-mode/v1"
    ).replace(/\/+$/, "");
    return { url: `${base}/chat/completions`, apiKey, model };
  }

  if (provider === "deepseek") {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return null;
    return {
      url:
        process.env.DEEPSEEK_API_URL ||
        "https://api.deepseek.com/v1/chat/completions",
      apiKey,
      model,
    };
  }

  if (provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;
    return {
      url:
        process.env.OPENAI_API_URL ||
        "https://api.openai.com/v1/chat/completions",
      apiKey,
      model,
    };
  }

  // ollama 及未配置的情况：不支持工具调用
  return null;
}

/** 当前 Provider 是否支持标准 Function Calling。 */
export function isToolCallingAvailable(): boolean {
  return resolveEndpoint() !== null;
}

/**
 * 执行一轮对话。开启流式，正文增量通过 onToken 实时回调，
 * 同时在整个流结束后返回累积的正文与 tool_calls。
 */
export async function chatRound(
  messages: ChatMessage[],
  tools: ChatTool[],
  onToken?: (token: string) => void,
): Promise<ChatRoundResult> {
  const endpoint = resolveEndpoint();
  if (!endpoint) {
    throw new Error(
      "当前 LLM Provider 不支持函数调用（仅 qwen / deepseek / openai 的兼容模式支持）",
    );
  }

  const body: Record<string, unknown> = {
    model: endpoint.model,
    messages,
    temperature: 0.7,
    stream: true,
  };
  if (tools.length > 0) {
    body.tools = tools;
    body.tool_choice = "auto";
  }

  const response = await fetch(endpoint.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${endpoint.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`LLM API 错误 ${response.status}: ${errText}`);
  }

  const reader = (response.body as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";

  // tool_calls 会分多个 delta 片段下发，按 index 聚合后拼装
  const toolCallMap = new Map<
    number,
    { id: string; name: string; args: string }
  >();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data:")) continue;

      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;

      let parsed: any;
      try {
        parsed = JSON.parse(payload);
      } catch {
        continue;
      }

      const delta = parsed?.choices?.[0]?.delta;
      if (!delta) continue;

      if (typeof delta.content === "string" && delta.content) {
        content += delta.content;
        onToken?.(delta.content);
      }

      const calls = delta.tool_calls;
      if (Array.isArray(calls)) {
        for (const call of calls) {
          const index = typeof call?.index === "number" ? call.index : 0;
          const existing = toolCallMap.get(index) ?? {
            id: "",
            name: "",
            args: "",
          };
          if (call?.id) existing.id = call.id;
          if (call?.function?.name) existing.name = call.function.name;
          if (typeof call?.function?.arguments === "string") {
            existing.args += call.function.arguments;
          }
          toolCallMap.set(index, existing);
        }
      }
    }
  }

  const toolCalls: ChatToolCall[] = [...toolCallMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .filter(([, value]) => value.name)
    .map(([index, value]) => ({
      id: value.id || `call_${index}`,
      type: "function" as const,
      function: { name: value.name, arguments: value.args || "{}" },
    }));

  return { content, toolCalls };
}
