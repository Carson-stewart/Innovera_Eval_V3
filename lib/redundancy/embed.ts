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
 * One embedding API call for a single batch. Returns a batch-local array of
 * length `batch.length`; a slot is left `undefined` only if the API omitted
 * that index or returned an empty/invalid vector for it. Throws on HTTP error.
 */
async function fetchEmbeddingBatch(
  apiKey: string,
  batch: string[]
): Promise<Array<number[] | undefined>> {
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
  const batchVectors: Array<number[] | undefined> = new Array(batch.length);
  for (const item of json.data) {
    if (
      item.index >= 0 &&
      item.index < batch.length &&
      Array.isArray(item.embedding) &&
      item.embedding.length > 0
    ) {
      batchVectors[item.index] = item.embedding;
    }
  }
  return batchVectors;
}

/** Indices of slots that did not receive a real vector. */
function missingIndices(batchVectors: Array<number[] | undefined>): number[] {
  const missing: number[] = [];
  for (let idx = 0; idx < batchVectors.length; idx++) {
    if (batchVectors[idx] === undefined) missing.push(idx);
  }
  return missing;
}

/**
 * Embed a batch of texts. Returns one 1536-dim vector per input text, in input
 * order, with a hard guarantee that every text received a real vector.
 *
 * Batches automatically at BATCH_SIZE. If any embedding is missing from a batch
 * response, the batch is retried ONCE; if a vector is still missing the whole
 * call throws (EmbeddingError). It NEVER falls back to an empty `[]` vector — a
 * silent `[]` would clusters as a zero-norm singleton and corrupt the SRI.
 *
 * On a healthy response (every index present, every vector non-empty) the
 * collected array is identical, slot-for-slot, to the previous index-fill
 * implementation, so the resulting vectors — and therefore the SRI — are
 * unchanged. Only the absent-embedding path differs (throw vs. silent hole).
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new EmbeddingError("OPENROUTER_API_KEY not set", 0);
  if (texts.length === 0) return [];

  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    // First attempt.
    let batchVectors = await fetchEmbeddingBatch(apiKey, batch);
    let missing = missingIndices(batchVectors);

    // Retry the batch exactly once if anything is missing.
    if (missing.length > 0) {
      batchVectors = await fetchEmbeddingBatch(apiKey, batch);
      missing = missingIndices(batchVectors);
    }

    // Hard failure rather than a silent [] fallback.
    if (missing.length > 0) {
      throw new EmbeddingError(
        `Embeddings API returned ${missing.length}/${batch.length} missing vectors ` +
          `in batch at offset ${i} after one retry (indices ${missing.join(", ")}); ` +
          `refusing to fall back to empty vectors`,
        0
      );
    }

    for (const v of batchVectors) allEmbeddings.push(v as number[]);
  }

  // Collector assertion: one real vector per input text.
  if (allEmbeddings.length !== texts.length) {
    throw new EmbeddingError(
      `Embedding collector size mismatch: ${allEmbeddings.length} vectors for ${texts.length} texts`,
      0
    );
  }

  return allEmbeddings;
}
