/**
 * Sentence embedding using @xenova/transformers all-MiniLM-L6-v2 (384-dim).
 * Loaded lazily on first call; cached in process memory after that.
 * Falls back to null if the model fails to download or load, at which point
 * the dedup layer falls back to address-based matching.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pipelineInstance: any | null = null;
let loadAttempted = false;

async function loadPipeline(): Promise<boolean> {
  if (loadAttempted) return pipelineInstance !== null;
  loadAttempted = true;
  try {
    // Dynamic import so the module doesn't crash the whole process if
    // @xenova/transformers is not installed or ONNX runtime is unavailable.
    const { pipeline, env } = await import('@xenova/transformers');
    // Suppress progress bars in production
    env.allowLocalModels = false;
    env.useBrowserCache = false;
    pipelineInstance = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2',
      { revision: 'main' }
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns a 384-dim unit vector for `text`, or null if the model is
 * unavailable (first run before download completes, network error, etc.).
 */
export async function embed(text: string): Promise<number[] | null> {
  const ok = await loadPipeline();
  if (!ok || !pipelineInstance) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const output = await pipelineInstance(text, { pooling: 'mean', normalize: true });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return Array.from(output.data as Float32Array) as number[];
  } catch {
    return null;
  }
}

/**
 * Cosine similarity between two unit vectors. Returns 0..1.
 * Both vectors must be unit-length (normalized); all-MiniLM-L6-v2 with
 * normalize=true satisfies this.
 */
export function cosineSim(a: number[], b: number[]): number {
  let dot = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i]! * b[i]!;
  }
  // Clamp to [0, 1] to handle float rounding
  return Math.max(0, Math.min(1, dot));
}

/**
 * Fallback similarity for when embeddings are unavailable.
 * Extracts 0x addresses from both texts and returns 1.0 if they share at
 * least one address, else Jaccard overlap on lowercase tokens.
 */
export function fallbackSim(a: string, b: string): number {
  const addrRe = /0x[0-9a-fA-F]{40}/gi;
  const addrsA = new Set((a.match(addrRe) ?? []).map((s) => s.toLowerCase()));
  const addrsB = new Set((b.match(addrRe) ?? []).map((s) => s.toLowerCase()));
  // Any shared address → high similarity (both are asking about the same object)
  for (const addr of addrsA) {
    if (addrsB.has(addr)) return 0.9;
  }
  // Jaccard on word tokens
  const tokensA = new Set(a.toLowerCase().split(/\W+/).filter((t) => t.length > 3));
  const tokensB = new Set(b.toLowerCase().split(/\W+/).filter((t) => t.length > 3));
  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }
  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Extract all 0x addresses from text (lowercased). */
export function extractAddresses(text: string): string[] {
  const matches = text.match(/0x[0-9a-fA-F]{40}/gi) ?? [];
  return [...new Set(matches.map((s) => s.toLowerCase()))];
}
