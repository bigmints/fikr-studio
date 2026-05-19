// @xenova/transformers is loaded lazily (via dynamic import) to prevent a
// module-evaluation crash in Electron's static-file renderer.  Importing it at
// the top level causes Object.keys() to be called on an undefined value inside
// the library's own module initialiser, which kills the renderer before any UI
// renders.  Deferring to getModelLoaded() avoids this entirely.

// ─── Internal state ───────────────────────────────────────────────────────────

/** Cached feature-extraction pipeline (singleton). */
let extractor: import("@xenova/transformers").FeatureExtractionPipeline | null = null;

/** In-flight load promise — coalesces concurrent calls. */
let loadingPromise: Promise<void> | null = null;

/**
 * Maximum sequence length the model can handle (512 tokens ≈ 384 safe chars after
 * tokenization). We chunk text into overlapping windows of this size.
 */
const CHUNK_SIZE = 384;
const CHUNK_OVERLAP = 64;

/** Default timeout for a single forward pass (ms). */
const INFERENCE_TIMEOUT_MS = 5000;

/** Maximum batch size per forward pass — large batches OOM on some devices. */
const MAX_BATCH_SIZE = 16;

/**
 * Yield to the browser event loop for ~0ms so the UI doesn't freeze during
 * long inference runs.
 */
function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}


/**
 * Chunk text into overlapping windows.
 */
function chunkText(text: string, chunkSize: number = CHUNK_SIZE, overlap: number = CHUNK_OVERLAP): string[] {
  if (text.length <= chunkSize) return [text];
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += (chunkSize - overlap)) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Average an array of normalized embeddings and re-normalize the result.
 */
function averageEmbeddings(embeddings: Float32Array[]): Float32Array {
  if (embeddings.length === 1) return embeddings[0];
  const dim = embeddings[0].length;
  const out = new Float32Array(dim);
  for (const emb of embeddings) {
    for (let i = 0; i < dim; i++) {
      out[i] += emb[i];
    }
  }
  let norm = 0;
  for (let i = 0; i < dim; i++) {
    norm += out[i] ** 2;
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dim; i++) {
      out[i] /= norm;
    }
  }
  return out;
}

/**
 * Wait for the promise or reject after `timeoutMs` milliseconds.
 */
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
        timeoutMs,
      ),
    ),
  ]);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Mean-pool a 3-D tensor `[batch, seq_len, hidden]` across the sequence
 * dimension, then L2-normalise each resulting vector in-place.
 *
 * The attention mask is **not** used — we average over every token position
 * (including [CLS] and [PAD]).  For `all-MiniLM-L6-v2` this matches the
 * behaviour of the original sentence-transformers implementation.
 *
 * @returns A `Float32Array[hidden]` per batch item (length === batch * hidden).
 */
function meanPoolAndNormalize(tensor: import("@xenova/transformers").Tensor): Float32Array {
  const [batch, seqLen, hidden] = tensor.dims;
  const data = tensor.data as unknown[];
  const out = new Float32Array(batch * hidden);

  for (let b = 0; b < batch; b++) {
    const bOffset = b * seqLen * hidden;
    const oOffset = b * hidden;

    // Mean pooling across sequence dimension.
    for (let h = 0; h < hidden; h++) {
      let sum = 0;
      for (let s = 0; s < seqLen; s++) {
        sum += data[bOffset + s * hidden + h] as number;
      }
      out[oOffset + h] = sum / seqLen;
    }

    // L2 normalise.
    let norm = 0;
    for (let h = 0; h < hidden; h++) {
      norm += out[oOffset + h] ** 2;
    }
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let h = 0; h < hidden; h++) {
        out[oOffset + h] /= norm;
      }
    }
  }

  return out;
}

/** Slice one embedding row from a batched Float32Array. */
function sliceEmbedding(
  batch: Float32Array,
  index: number,
  dim: number,
): Float32Array {
  return batch.slice(index * dim, (index + 1) * dim);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Check whether the embedding model has already been loaded into memory.
 *
 * @returns `true` if a subsequent `embedText` / `embedBatch` call will not
 *          trigger a network request for the model weights.
 */
export function isModelLoaded(): boolean {
  return extractor !== null;
}

/**
 * Ensure the embedding model is loaded and ready.
 *
 * Triggers a one-time download of the `Xenova/all-MiniLM-L6-v2` weights
 * (~22 MB, cached in the browser afterward).  Subsequent calls resolve
 * immediately.  Call this before the first search to avoid unexpected
 * latency.
 *
 * @throws If the model fails to download or initialise.
 */
export async function getModelLoaded(): Promise<void> {
  if (extractor !== null) return;
  if (loadingPromise !== null) return loadingPromise;

  loadingPromise = (async () => {
    try {
      const { pipeline, env } = await import("@xenova/transformers");
      // Force remote models — never look for a local copy on disk.
      env.allowLocalModels = false;
      const pipelineResult = await pipeline(
        "feature-extraction",
        "Xenova/all-MiniLM-L6-v2",
      );
      extractor = pipelineResult as import("@xenova/transformers").FeatureExtractionPipeline;
    } catch (error) {
      loadingPromise = null; // allow retry
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to load embedding model (Xenova/all-MiniLM-L6-v2). ` +
          `The model is ~22 MB and will be cached after the first download. ` +
          `Details: ${msg}`,
        { cause: error },
      );
    }
  })();

  return loadingPromise;
}

/**
 * Create a 384-dimensional embedding for a single piece of text.
 *
 * The returned vector is L2-normalised, so cosine similarity between two
 * embeddings can be computed as a simple dot product.
 *
 * Text longer than the model's max sequence length (512 tokens ≈ 2000 chars)
 * is silently truncated.
 *
 * @param text  The text to embed.
 * @returns A normalised `Float32Array` of length 384.
 */
export async function embedText(text: string): Promise<Float32Array> {
  await getModelLoaded();
  /* v8 ignore next */ // unreachable guard
  if (extractor === null) throw new Error("Extractor is unexpectedly null");

  // Chunk input BEFORE embedding to prevent model timeout
  const chunks = chunkText(text);
  
  if (chunks.length === 1) {
    const output = (await withTimeout(
      extractor(chunks[0], {
        pooling: "none", // we pool manually so we control the exact behaviour
        normalize: false,
      }) as Promise<import("@xenova/transformers").Tensor>,
      INFERENCE_TIMEOUT_MS,
      "embedText inference",
    )) as import("@xenova/transformers").Tensor;
  
    // output.dims === [1, seqLen, 384]
    const pooled = meanPoolAndNormalize(output);
    return sliceEmbedding(pooled, 0, 384);
  }

  // Handle multiple chunks
  const chunkEmbeddings: Float32Array[] = [];
  for (const chunk of chunks) {
    const output = (await withTimeout(
      extractor(chunk, {
        pooling: "none",
        normalize: false,
      }) as Promise<import("@xenova/transformers").Tensor>,
      INFERENCE_TIMEOUT_MS,
      "embedText inference",
    )) as import("@xenova/transformers").Tensor;
    const pooled = meanPoolAndNormalize(output);
    chunkEmbeddings.push(sliceEmbedding(pooled, 0, 384));
  }
  
  return averageEmbeddings(chunkEmbeddings);
}

/**
 * Create 384-dimensional embeddings for multiple texts in a single forward
 * pass.  More efficient than calling `embedText` in a loop because texts are
 * tokenised and padded together.
 *
 * Each returned vector is L2-normalised.
 *
 * @param texts  Array of strings to embed.
 * @returns Array of normalised `Float32Array`s (each length 384), in the same
 *          order as the input.
 */
export async function embedBatch(texts: string[]): Promise<Float32Array[]> {
  if (texts.length === 0) return [];

  await getModelLoaded();
  /* v8 ignore next */ // unreachable guard
  if (extractor === null) throw new Error("Extractor is unexpectedly null");

  // Process in small chunks to avoid OOM on large batches.
  const results: Float32Array[] = [];

  for (let start = 0; start < texts.length; start += MAX_BATCH_SIZE) {
    // Yield to browser between chunks so UI doesn't freeze
    await yieldToBrowser();

    const batchTexts = texts.slice(start, start + MAX_BATCH_SIZE);
    
    // Some texts in this batch might be chunked
    const chunkMap: { textIndex: number; chunkIndex: number; chunkStr: string }[] = [];
    batchTexts.forEach((t, i) => {
      const chunks = chunkText(t);
      chunks.forEach((c, j) => {
        chunkMap.push({ textIndex: start + i, chunkIndex: j, chunkStr: c });
      });
    });

    // Embed the chunks for this batch
    const chunkEmbeddings = new Map<number, Float32Array[]>();
    
    for (let cStart = 0; cStart < chunkMap.length; cStart += MAX_BATCH_SIZE) {
      await yieldToBrowser();
      const currentChunks = chunkMap.slice(cStart, cStart + MAX_BATCH_SIZE);
      const chunkStrs = currentChunks.map(c => c.chunkStr);
      
      const output = (await withTimeout(
        extractor(chunkStrs as never, {
          pooling: "none",
          normalize: false,
        }) as Promise<import("@xenova/transformers").Tensor>,
        INFERENCE_TIMEOUT_MS * 3, // Allow more time for batches
        "embedBatch inference",
      )) as import("@xenova/transformers").Tensor;

      const pooled = meanPoolAndNormalize(output);
      for (let i = 0; i < currentChunks.length; i++) {
        const item = currentChunks[i];
        if (!chunkEmbeddings.has(item.textIndex)) chunkEmbeddings.set(item.textIndex, []);
        chunkEmbeddings.get(item.textIndex)!.push(sliceEmbedding(pooled, i, 384));
      }
    }

    // Average the embeddings for each original text in this batch
    for (let i = 0; i < batchTexts.length; i++) {
      const textIndex = start + i;
      const embs = chunkEmbeddings.get(textIndex) || [];
      results.push(averageEmbeddings(embs));
    }
  }

  return results;
}

/**
 * Compute the cosine similarity between two vectors.
 *
 * If both vectors are already L2-normalised (as produced by `embedText` /
 * `embedBatch`), this is equivalent to a dot product and is very fast.
 *
 * @param a  First vector.
 * @param b  Second vector (must have the same length).
 * @returns A value in `[-1, 1]` where `1` means identical direction.
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}
