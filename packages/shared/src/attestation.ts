import type { ResearchSynthesis } from './types/agent';

// Canonical verdict shape used for hashing + signing. We strip out the
// self-graded callGrades + contradictions because those are descriptive
// analytics the LLM produced, not the verdict the user is being asked
// to trust. Keeping the hash stable over dashboard-display fields
// (verdict + confidence + summary + keyFacts) is what makes the
// on-chain attestation verifiable: anyone can recompute the same hash
// from the stored synthesis and compare to the contract row.
export interface CanonicalVerdictPayload {
  sessionId: string;
  question: string;
  verdict: string;
  confidence: 'low' | 'medium' | 'high';
  confidenceScore: number;
  summary: string;
  keyFacts: string[];
  totalSpentMinimal: string;
  timestamp: number;
}

export function buildCanonicalVerdict(input: {
  sessionId: string;
  question: string;
  synthesis: ResearchSynthesis;
  totalSpentMinimal: string;
  timestamp: number;
}): CanonicalVerdictPayload {
  const { sessionId, question, synthesis, totalSpentMinimal, timestamp } = input;
  return {
    sessionId,
    question,
    verdict: synthesis.verdict,
    confidence: synthesis.confidence,
    confidenceScore: synthesis.confidenceScore,
    summary: synthesis.summary,
    keyFacts: [...synthesis.keyFacts],
    totalSpentMinimal,
    timestamp,
  };
}

// Deterministic JSON serialization: sort keys recursively so the same
// logical object always produces the exact same byte sequence. This is
// the contract between sign-time and verify-time: the Consumer hashes
// this bytes blob, signs it, and attests the hash on-chain; a verifier
// later recomputes the same bytes blob and the same hash to prove the
// stored synthesis matches what was attested.
export function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map((v) => canonicalStringify(v)).join(',') + ']';
  }
  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  return (
    '{' +
    sortedKeys
      .map((k) => JSON.stringify(k) + ':' + canonicalStringify(obj[k]))
      .join(',') +
    '}'
  );
}
