/**
 * OpenClaw Gateway LLM HTTP Client
 * Completions stateless vía /v1/chat/completions del Gateway.
 * NUNCA usa CLI. Todo pasa por HTTP API del Gateway.
 */

const GATEWAY_URL =
  process.env.OPENCLAW_GATEWAY_HTTP_URL ||
  (process.env.OPENCLAW_GATEWAY_URL || "ws://127.0.0.1:18789")
    .replace("ws://", "http://")
    .replace("wss://", "https://");

const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || "";
const DEFAULT_MODEL = process.env.OPENCLAW_DEFAULT_MODEL || "openclaw";
const LLM_TIMEOUT_MS = Number(process.env.OPENCLAW_GATEWAY_LLM_TIMEOUT_MS || "300000");
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 3000;

export interface LLMCompletionOptions {
  model?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  jsonMode?: boolean;
}

export interface LLMCompletionResult {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Envía un prompt y obtiene una completion stateless.
 */
export async function complete(
  prompt: string,
  options: LLMCompletionOptions = {}
): Promise<LLMCompletionResult> {
  const {
    model = DEFAULT_MODEL,
    systemPrompt,
    temperature = 0.7,
    maxTokens = 8192,
    timeoutMs = LLM_TIMEOUT_MS,
    signal,
    jsonMode = false,
  } = options;

  const messages: Array<{ role: string; content: string }> = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: prompt });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (signal?.aborted) throw new Error("LLM completion aborted by caller");

    if (attempt > 0) {
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
      console.log(`[LLM] Retry ${attempt}/${MAX_RETRIES} after ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      if (signal?.aborted) throw new Error("LLM completion aborted by caller");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${GATEWAY_URL}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GATEWAY_TOKEN}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
          ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
        }),
        signal: signal ? AbortSignal.any([controller.signal, signal]) : controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LLM completion failed (${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as {
        model: string;
        choices?: Array<{ message: { content: string } }>;
        usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      };

      const content = data.choices?.[0]?.message?.content || "";
      console.log(`[LLM] Response usage:`, JSON.stringify(data.usage || null), `model: ${data.model}`);

      return {
        content,
        model: data.model || model,
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
      };
    } catch (error) {
      clearTimeout(timeout);
      lastError = error instanceof Error ? error : new Error(String(error));
      const callerAborted = signal?.aborted || lastError.message.includes("aborted by caller");
      const isNetwork =
        lastError.message.includes("fetch failed") ||
        lastError.message.includes("ECONNREFUSED") ||
        lastError.message.includes("ECONNRESET");

      if (callerAborted) throw lastError;
      if (isNetwork) {
        console.error(`[LLM] Attempt ${attempt + 1} failed (network): ${lastError.message}`);
        continue;
      }
      throw lastError;
    }
  }

  throw lastError || new Error("LLM completion failed after retries");
}

/**
 * Envía un prompt y parsea la respuesta como JSON.
 */
export async function completeJSON<T = unknown>(
  prompt: string,
  options: LLMCompletionOptions = {}
): Promise<{ data: T; raw: string; model: string; usage: LLMCompletionResult["usage"] }> {
  const result = await complete(prompt, { ...options, jsonMode: true });

  const candidates = [
    result.content.trim(),
    result.content.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1]?.trim(),
    (() => {
      const firstBrace = result.content.indexOf("{");
      const lastBrace = result.content.lastIndexOf("}");
      return firstBrace !== -1 && lastBrace > firstBrace
        ? result.content.slice(firstBrace, lastBrace + 1)
        : null;
    })(),
    (() => {
      const firstBracket = result.content.indexOf("[");
      const lastBracket = result.content.lastIndexOf("]");
      return firstBracket !== -1 && lastBracket > firstBracket
        ? result.content.slice(firstBracket, lastBracket + 1)
        : null;
    })(),
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return { data: JSON.parse(candidate) as T, raw: result.content, model: result.model, usage: result.usage };
    } catch {
      // continue
    }
  }

  throw new Error(
    `Failed to parse JSON from LLM response. Raw content (first 500 chars): ${result.content.slice(0, 500)}`
  );
}

/**
 * Helper rápido para resúmenes / análisis simples sin mantener estado.
 */
export async function quickAnalyze(
  context: string,
  instruction: string,
  options?: Omit<LLMCompletionOptions, "systemPrompt">
): Promise<LLMCompletionResult> {
  return complete(`${instruction}\n\n---\n${context}`, {
    systemPrompt:
      "Eres un asistente experto en análisis de sistemas, salud de infraestructura y diagnóstico técnico. Responde de forma clara, concisa y accionable.",
    temperature: 0.4,
    maxTokens: 4096,
    ...options,
  });
}
