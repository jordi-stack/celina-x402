import { z } from 'zod';

export const CycleStateSchema = z.enum([
  'IDLE',
  'DECIDING',
  'SIGNING',
  'REPLAYING',
  'VERIFYING',
  'SETTLING',
  'COMPLETED',
  'FAILED',
  'HALTED',
]);
export type CycleState = z.infer<typeof CycleStateSchema>;

export const ServiceNameSchema = z.enum([
  'market-snapshot',
  'trench-scan',
  'swap-quote',
]);
export type ServiceName = z.infer<typeof ServiceNameSchema>;

export const DecisionSchema = z.object({
  action: z.enum(['consume_service', 'wait', 'halt']),
  service: ServiceNameSchema.optional(),
  reason: z.string().min(10).max(500),
  expected_benefit: z.string().min(5).max(200),
});
export type Decision = z.infer<typeof DecisionSchema>;

// === Intelligence Agent (2026-04-15 pivot) ===
// The 5 new Producer research + signal services exposed to the goal-directed
// Consumer. Each one costs USDG via the x402 gate, so the Consumer picks
// them deliberately based on the parsed user question.
export const ResearchServiceNameSchema = z.enum([
  'research-token-report',
  'research-wallet-risk',
  'research-liquidity-health',
  'signal-whale-watch',
  'signal-new-token-scout',
]);
export type ResearchServiceName = z.infer<typeof ResearchServiceNameSchema>;

// LLM output when asked "given the question + what's been called so far,
// what do we do next". Either call another service (with args), synthesize
// the final answer from accumulated results, or abort early if the question
// can't be answered by the available services.
export const ResearchStepSchema = z.object({
  action: z.enum(['call_service', 'synthesize', 'abort']),
  service: ResearchServiceNameSchema.optional(),
  // Free-form args the LLM populates (typically { tokenAddress } or { address }).
  // Validated per-service by the Producer route's JSON schema, so we keep it
  // loose here.
  serviceArgs: z.record(z.string(), z.unknown()).optional(),
  reason: z.string().min(5).max(500),
});
export type ResearchStep = z.infer<typeof ResearchStepSchema>;

// LLM output when asked to synthesize the final answer from a session's
// accumulated service results. Confidence is coarse on purpose — the LLM
// is not calibrated and fine-grained percentages would be misleading.
export const ResearchSynthesisSchema = z.object({
  verdict: z.string().min(5).max(200),
  confidence: z.enum(['low', 'medium', 'high']),
  summary: z.string().min(20).max(2000),
  keyFacts: z.array(z.string()).max(10).default([]),
});
export type ResearchSynthesis = z.infer<typeof ResearchSynthesisSchema>;

// One service call within a session: the service name, the args the LLM
// chose, the raw response (or error), and the x402 tx hash if settlement
// succeeded. The Consumer's session runner appends to this on every step.
export const ResearchCallSchema = z.object({
  service: ResearchServiceNameSchema,
  args: z.record(z.string(), z.unknown()),
  amountSpent: z.string(),
  txHash: z.string().nullable(),
  data: z.unknown().nullable(),
  error: z.string().nullable(),
  startedAt: z.number(),
  durationMs: z.number(),
});
export type ResearchCall = z.infer<typeof ResearchCallSchema>;

// Top-level session row stored in `query_sessions`. `status` walks
// `planning -> calling -> synthesizing -> done | aborted | failed`.
export const ResearchSessionStatusSchema = z.enum([
  'planning',
  'calling',
  'synthesizing',
  'done',
  'aborted',
  'failed',
]);
export type ResearchSessionStatus = z.infer<typeof ResearchSessionStatusSchema>;

export const ResearchSessionSchema = z.object({
  id: z.string(),
  question: z.string().min(1).max(2000),
  status: ResearchSessionStatusSchema,
  calls: z.array(ResearchCallSchema),
  totalSpent: z.string(),
  synthesis: ResearchSynthesisSchema.nullable(),
  createdAt: z.number(),
  completedAt: z.number().nullable(),
  error: z.string().nullable(),
});
export type ResearchSession = z.infer<typeof ResearchSessionSchema>;

export const PaymentStatusSchema = z.enum([
  'signed',
  'verified',
  'settled',
  'settle_failed',
  'settle_abandoned',
]);
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

export const AuditEventSchema = z.object({
  id: z.number().optional(),
  timestamp: z.number(),
  source: z.enum(['producer', 'consumer', 'orchestrator']),
  kind: z.string(),
  cycleNumber: z.number().nullable(),
  payload: z.record(z.string(), z.unknown()),
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;
