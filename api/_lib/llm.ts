export type LlmProvider = "openai" | "anthropic" | "gemini";

export interface LlmConfig {
  provider: LlmProvider;
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export interface ChatJsonParams {
  system: string;
  user: string;
  maxTokens: number;
}

const TIMEOUT_MS = 45_000;

export function getLlmConfig(): LlmConfig | null {
  const rawProvider = (process.env.LLM_PROVIDER || "").trim().toLowerCase();
  const apiKey = (process.env.LLM_API_KEY || "").trim();
  const model = (process.env.LLM_MODEL || "").trim();
  const baseUrl = (process.env.LLM_BASE_URL || "").trim() || undefined;

  if (
    !apiKey ||
    !model ||
    (rawProvider !== "openai" &&
      rawProvider !== "anthropic" &&
      rawProvider !== "gemini")
  ) {
    return null;
  }

  return {
    provider: rawProvider,
    apiKey,
    model,
    baseUrl,
  };
}

function extractJsonString(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch && fenceMatch[1]) {
    return fenceMatch[1].trim();
  }
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function callProviderRaw(
  config: LlmConfig,
  params: ChatJsonParams
): Promise<string> {
  const { provider, apiKey, model, baseUrl } = config;
  const { system, user, maxTokens } = params;

  if (provider === "gemini") {
    const host = (
      baseUrl || "https://generativelanguage.googleapis.com"
    ).replace(/\/+$/, "");
    const url = `${host}/v1beta/models/${encodeURIComponent(model)}:generateContent`;

    const res = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: system }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: user }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: maxTokens,
          temperature: 0.4,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Gemini API 请求失败 (${res.status}): ${errText.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const content =
      data.candidates?.[0]?.content?.parts
        ?.map((p) => p.text ?? "")
        .join("") ?? "";

    if (!content.trim()) {
      throw new Error("Gemini API 返回空内容");
    }
    return content;
  }

  if (provider === "openai") {
    const host = (baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
    const url = `${host}/chat/completions`;

    const res = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: maxTokens,
        temperature: 0.4,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`OpenAI API 请求失败 (${res.status}): ${errText.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{
        message?: { content?: string };
      }>;
    };

    const content = data.choices?.[0]?.message?.content ?? "";
    if (!content.trim()) {
      throw new Error("OpenAI API 返回空内容");
    }
    return content;
  }

  // anthropic
  const host = (baseUrl || "https://api.anthropic.com").replace(/\/+$/, "");
  const url = `${host}/v1/messages`;

  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      system,
      messages: [{ role: "user", content: user }],
      max_tokens: maxTokens,
      temperature: 0.4,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Anthropic API 请求失败 (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };

  const content =
    data.content
      ?.filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("") ?? "";

  if (!content.trim()) {
    throw new Error("Anthropic API 返回空内容");
  }
  return content;
}

export async function chatJSON<T = Record<string, unknown>>(
  params: ChatJsonParams
): Promise<T> {
  const config = getLlmConfig();
  if (!config) {
    throw new Error("LLM 环境变量未配置完整");
  }

  let lastError: unknown = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    const userPrompt =
      attempt === 0
        ? params.user
        : `${params.user}\n\n【重要重试要求】上一次输出无法被 JSON.parse 解析。请只输出一个合法、完整的 JSON 对象，不要包含任何额外解释或非 JSON 文本。`;

    const rawText = await callProviderRaw(config, {
      ...params,
      user: userPrompt,
    });

    try {
      const jsonStr = extractJsonString(rawText);
      const parsed = JSON.parse(jsonStr);
      if (parsed && typeof parsed === "object") {
        return parsed as T;
      }
      lastError = new Error("模型返回的 JSON 不是对象");
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error(
    `模型 JSON 解析失败（已重试一次）: ${lastError instanceof Error ? lastError.message : String(lastError)}`
  );
}
