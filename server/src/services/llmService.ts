import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

interface LLMConfig {
  provider: "qwen" | "deepseek" | "openai" | "ollama";
  model: string;
  apiKey?: string;
  apiUrl: string;
  timeout: number;
}

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT =
  "You are a helpful knowledge assistant. Provide concise and accurate answers.";

function createLLMConfig(): LLMConfig {
  const provider = (
    process.env.LLM_PROVIDER || "qwen"
  ).toLowerCase() as LLMConfig["provider"];
  const model = process.env.LLM_MODEL || "qwen-plus";
  const timeout = 60000;

  const configs: Record<string, Partial<LLMConfig>> = {
    qwen: {
      apiKey: process.env.QWEN_API_KEY,
      apiUrl:
        process.env.QWEN_API_URL ||
        "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
    },
    deepseek: {
      apiKey: process.env.DEEPSEEK_API_KEY,
      apiUrl:
        process.env.DEEPSEEK_API_URL ||
        "https://api.deepseek.com/v1/chat/completions",
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      apiUrl:
        process.env.OPENAI_API_URL ||
        "https://api.openai.com/v1/chat/completions",
    },
    ollama: {
      apiUrl: process.env.OLLAMA_API_URL || "http://localhost:11434/api/chat",
      timeout: 120000,
    },
  };

  const config = configs[provider];
  if (!config) {
    throw new Error(`Unsupported LLM provider: ${provider}`);
  }

  return {
    provider,
    model,
    apiKey: config.apiKey,
    apiUrl: config.apiUrl!,
    timeout: config.timeout || timeout,
  };
}

const config = createLLMConfig();

function buildMessages(question: string, context?: string): Message[] {
  const messages: Message[] = [{ role: "system", content: SYSTEM_PROMPT }];

  const userContent = context
    ? `Context: ${context}\n\nQuestion: ${question}`
    : question;

  messages.push({ role: "user", content: userContent });
  return messages;
}

function buildRequestBody(provider: string, messages: Message[]): any {
  const baseRequest = { model: config.model, temperature: 0.7 };

  switch (provider) {
    case "qwen":
      return {
        ...baseRequest,
        input: { messages },
        parameters: { temperature: 0.7, max_tokens: 2000 },
      };
    case "ollama":
      return { ...baseRequest, messages, stream: false };
    default:
      return { ...baseRequest, messages };
  }
}

function buildHeaders(config: LLMConfig): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
    console.log(`[LLM] API Key loaded: ${config.apiKey.substring(0, 10)}...`);
  } else {
    console.log(`[LLM] WARNING: No API Key configured!`);
  }

  return headers;
}

function parseResponse(provider: string, data: any): string {
  switch (provider) {
    case "qwen":
      return (
        data?.output?.text || data?.output?.choices?.[0]?.message?.content || ""
      );
    case "ollama":
      return data?.message?.content || "";
    default:
      return data?.choices?.[0]?.message?.content || "";
  }
}

function isConfigured(config: LLMConfig): boolean {
  return config.provider === "ollama" || !!config.apiKey;
}

function getMockResponse(question: string): string {
  return `[模拟AI响应]\n\n您的问题是: "${question}"\n\n要获得真实的AI响应，请在 server/.env 文件中配置以下选项之一:\n\n1. **千问 (推荐)**: 设置 QWEN_API_KEY 和 LLM_PROVIDER=qwen\n2. **DeepSeek**: 设置 DEEPSEEK_API_KEY 和 LLM_PROVIDER=deepseek\n3. **OpenAI**: 设置 OPENAI_API_KEY 和 LLM_PROVIDER=openai\n4. **本地Ollama**: 安装Ollama并运行模型，设置 LLM_PROVIDER=ollama\n\n当前显示模拟数据，因为未检测到有效的AI服务配置。`;
}

async function callLLMAPI(messages: Message[]): Promise<string> {
  console.log(
    `[LLM] Calling ${config.provider} API with model: ${config.model}`,
  );

  try {
    const requestBody = buildRequestBody(config.provider, messages);
    const headers = buildHeaders(config);

    const response = await axios.post(config.apiUrl, requestBody, {
      headers,
      timeout: config.timeout,
    });

    return parseResponse(config.provider, response.data);
  } catch (error: any) {
    console.error(
      `[LLM] ${config.provider} API Error:`,
      error.response?.data || error.message,
    );
    throw error;
  }
}

export async function generateAnswer(
  question: string,
  context?: string,
): Promise<string> {
  const messages = buildMessages(question, context);

  console.log(
    `[LLM] Using provider: ${config.provider}, model: ${config.model}`,
  );

  if (!isConfigured(config)) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return getMockResponse(question);
  }

  try {
    return await callLLMAPI(messages);
  } catch (error) {
    console.error("[LLM] Failed to generate answer:", error);
    throw error;
  }
}
