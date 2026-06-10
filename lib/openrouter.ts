/**
 * Scoring model — pinned to the dated OpenRouter snapshot for Claude Sonnet 4.5.
 *
 * Pin date: 2026-06-10. Confirmed routable on that date: a live call returns
 * `model: "anthropic/claude-4.5-sonnet-20250929"`, and this is the
 * `canonical_slug` OpenRouter lists behind the `anthropic/claude-sonnet-4.5`
 * id. The previous floating alias `anthropic/claude-sonnet-4-5` resolved to
 * this exact same backend snapshot today, so pinning is not expected to change
 * the served model — only to make every future run self-documenting.
 *
 * This is the model the 13 dimension scores AND redundancy claim-extraction run
 * on. Future scores may differ slightly from past ones if OpenRouter later
 * reroutes (now prevented by this pin); the pin does NOT alter any score already
 * stored. Step-4 measurement runs quantify the run-to-run noise floor.
 */
export const SCORING_MODEL = "anthropic/claude-4.5-sonnet-20250929";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_TIMEOUT_MS = 120_000;

export class OpenRouterError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: string
  ) {
    super(message);
    this.name = "OpenRouterError";
  }
}

export class JsonParseError extends Error {
  constructor(
    message: string,
    public readonly raw: string
  ) {
    super(message);
    this.name = "JsonParseError";
  }
}

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

interface CallModelParams {
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  timeoutMs?: number;
  /**
   * Sampling temperature. Default 0 — scoring calls must be as deterministic
   * as the model allows. Only raise this for explicitly creative tasks (e.g.
   * risk-generation brainstorming) and document the reason at the call site.
   */
  temperature?: number;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function doCall(params: CallModelParams): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new OpenRouterError("OPENROUTER_API_KEY not set", 0, "");
  }

  const messages: Message[] = [
    { role: "system", content: params.system },
    ...params.messages,
  ];

  const body = JSON.stringify({
    model: SCORING_MODEL,
    messages,
    temperature: params.temperature ?? 0,
  });

  const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const response = await fetchWithTimeout(
    OPENROUTER_API_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://innovera.ai",
        "X-Title": "Innovera Eval V3",
      },
      body,
    },
    timeoutMs
  );

  const responseText = await response.text();

  if (!response.ok) {
    throw new OpenRouterError(
      `OpenRouter API error: ${response.status} ${response.statusText}`,
      response.status,
      responseText
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    throw new OpenRouterError(
      "Failed to parse OpenRouter response as JSON",
      response.status,
      responseText
    );
  }

  const completion = parsed as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = completion?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new OpenRouterError(
      "Unexpected OpenRouter response shape",
      response.status,
      responseText
    );
  }

  return content;
}

function isRetryable(error: unknown): boolean {
  if (error instanceof OpenRouterError) {
    return error.status === 0 || error.status >= 500;
  }
  // Network errors (AbortError, fetch failure)
  return true;
}

export async function callModel(params: CallModelParams): Promise<string> {
  try {
    return await doCall(params);
  } catch (err) {
    if (isRetryable(err)) {
      // One automatic retry
      return await doCall(params);
    }
    throw err;
  }
}

function stripCodeFences(text: string): string {
  // Remove ```json ... ``` or ``` ... ``` wrappers
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/m);
  if (fenced) return fenced[1].trim();
  return text.trim();
}

export async function callModelJSON<T = unknown>(
  params: CallModelParams
): Promise<T> {
  const augmentedSystem =
    params.system +
    "\n\nIMPORTANT: Your response MUST be valid JSON only. Do not include any text before or after the JSON. Do not use code fences or markdown formatting. Return ONLY the raw JSON object.";

  const raw = await callModel({ ...params, system: augmentedSystem });
  const stripped = stripCodeFences(raw);

  try {
    return JSON.parse(stripped) as T;
  } catch {
    throw new JsonParseError(
      `Failed to parse model response as JSON: ${stripped.slice(0, 200)}`,
      raw
    );
  }
}
