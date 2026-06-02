/**
 * lib/redundancy/embed.ts
 *
 * OpenRouter embeddings via text-embedding-3-small (1536 dims, deterministic).
 * No temperature parameter for embeddings — same input always produces same vector.
 */

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/embeddings";
const EMBEDDING_MODEL = "openai/text-embedding-3-small";
/** Maximum texts per API call (OpenRouter limit ≈ 2048 inputs but we cap lower) */
const BATCH_SIZE = 128;

export class EmbeddingError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "EmbeddingError";
  }
}

interface EmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
}

/**
 * Embed a batch of texts. Returns one 1536-dim vector per input text.
 * Batches automatically at BATCH_SIZE to avoid payload limits.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new EmbeddingError("OPENROUTER_API_KEY not set", 0);
  if (texts.length === 0) return [];

  const allEmbeddings: number[][] = new Array(texts.length);

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const res = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://innovera.ai",
        "X-Title": "Innovera Eval V3 Redundancy",
      },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: batch }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new EmbeddingError(`Embeddings API error: ${res.status} — ${body.slice(0, 200)}`, res.status);
    }

    const json = (await res.json()) as EmbeddingResponse;
    for (const item of json.data) {
      allEmbeddings[i + item.index] = item.embedding;
    }
  }

  return allEmbeddings;
}
