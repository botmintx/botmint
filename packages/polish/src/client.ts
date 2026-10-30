import { sha256 } from "@botmint/core";

export type ChatResult = {
  content: string;
  usage: { inputTokens: number; cachedTokens: number; outputTokens: number };
};

export type PolishClientOptions = {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  sleep?: (ms: number) => Promise<void>;
  fetchImpl?: typeof fetch;
  maxTries?: number;
};

const defaultSleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function jitter(ms: number): number {
  const spread = Math.floor(ms * 0.1);
  return (
    ms + (spread === 0 ? 0 : Math.floor((sha256(String(ms)).charCodeAt(0) % (spread * 2)) - spread))
  );
}

export async function chatCompletion(
  options: PolishClientOptions,
  system: string,
  user: string,
): Promise<ChatResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const tries = options.maxTries ?? 5;
  let lastError = "request failed";
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const response = await fetchImpl(`${options.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: options.model,
          temperature: options.temperature,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });
      if (response.status === 429 || response.status >= 500) {
        const retryAfter = Number(response.headers.get("retry-after"));
        const backoff =
          Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : jitter(1000 * 2 ** (attempt - 1));
        lastError = `HTTP ${response.status}`;
        if (attempt === tries) break;
        await sleep(Math.min(backoff, 16_000));
        continue;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          prompt_tokens_details?: { cached_tokens?: number };
        };
      };
      const content = body.choices?.[0]?.message?.content;
      if (!content) throw new Error("empty completion");
      return {
        content,
        usage: {
          inputTokens: body.usage?.prompt_tokens ?? 0,
          cachedTokens: body.usage?.prompt_tokens_details?.cached_tokens ?? 0,
          outputTokens: body.usage?.completion_tokens ?? 0,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "network error";
      if (message.includes(options.apiKey)) lastError = "request failed";
      else lastError = message.replaceAll(options.apiKey, "[redacted]");
      if (attempt === tries) break;
      await sleep(jitter(1000 * 2 ** (attempt - 1)));
    }
  }
  throw new Error(lastError);
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
