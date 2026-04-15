/**
 * Pre-research dedup check.
 *
 * Before paying for a new session, Celina checks if a semantically similar
 * question was answered in the last 24h. If similarity >= THRESHOLD, the
 * cached verdict is returned and no new x402 calls are made.
 *
 * Strategy:
 * 1. Embed the incoming question with all-MiniLM-L6-v2.
 * 2. For each active memory row, compute cosine similarity.
 * 3. If best match >= THRESHOLD, it's a dedup hit.
 * 4. If embeddings are unavailable, fall back to address + Jaccard match.
 */

import type { Store } from '@x402/orchestrator';
import { embed, cosineSim, fallbackSim } from './embedder';

const SIMILARITY_THRESHOLD = 0.85;

export interface DedupHit {
  sessionId: string;
  question: string;
  verdict: string;
  confidenceScore: number;
  totalSpent: string;
  similarity: number;
  method: 'embedding' | 'fallback';
  cachedAt: number;
}

/**
 * Returns a DedupHit if a sufficiently similar session exists in memory,
 * or null if the question is novel and should run fresh research.
 */
export async function checkDedup(store: Store, question: string): Promise<DedupHit | null> {
  const memories = store.listActiveMemories();
  if (memories.length === 0) return null;

  // Try embedding-based similarity first
  const qEmbedding = await embed(question);

  let best: DedupHit | null = null;
  let bestSim = SIMILARITY_THRESHOLD - 0.0001; // must exceed threshold

  for (const mem of memories) {
    let sim: number;
    let method: 'embedding' | 'fallback';

    if (qEmbedding && mem.embedding) {
      sim = cosineSim(qEmbedding, mem.embedding);
      method = 'embedding';
    } else {
      sim = fallbackSim(question, mem.question);
      method = 'fallback';
    }

    if (sim > bestSim) {
      bestSim = sim;
      best = {
        sessionId: mem.sessionId,
        question: mem.question,
        verdict: mem.verdict,
        confidenceScore: mem.confidenceScore,
        totalSpent: mem.totalSpent,
        similarity: sim,
        method,
        cachedAt: mem.createdAt,
      };
    }
  }

  return best;
}

/**
 * Persist a completed session to memory so future queries can match against it.
 * Only persists sessions with status='done' and confidence >= 0.4.
 */
export async function persistToMemory(
  store: Store,
  opts: {
    sessionId: string;
    question: string;
    verdict: string;
    confidenceScore: number;
    totalSpent: string;
  }
): Promise<void> {
  if (opts.confidenceScore < 0.4) return; // don't memorize uncertain verdicts

  const { extractAddresses } = await import('./embedder');
  const addresses = extractAddresses(opts.question);
  const embedding = await embed(opts.question);

  store.insertMemory({
    sessionId: opts.sessionId,
    question: opts.question,
    embedding,
    extractedAddresses: addresses,
    verdict: opts.verdict,
    confidenceScore: opts.confidenceScore,
    totalSpent: opts.totalSpent,
  });
}
