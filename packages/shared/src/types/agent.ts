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
  // Added 2026-04-15 for the agent-to-agent x402 tier. Served by the
  // Celina sub-agent on port 3003. When the Consumer picks this service
  // the sub-agent itself pays the Producer via x402 under its own
  // wallet (Account 3) to fetch token-report + liquidity-health, then
  // correlates. Two x402 settlements visible on OKLink per call.
  'research-deep-dive',
  // Added 2026-04-15 for Tier 1 real DEX execution. Executes a live swap
  // on X Layer via OKX DEX aggregator (routes through Uniswap V4 + Revoswap).
  // Producer vault executes the trade; Consumer pays 0.020 USDG for the service.
  'action-swap-exec',
]);
export type ResearchServiceName = z.infer<typeof ResearchServiceNameSchema>;

// LLM output when asked "given the question + what's been called so far,
// what do we do next". Either call another service (with args), synthesize
// the final answer from accumulated results, or abort early if the question
// can't be answered by the available services.
//
// confidence + expectedValue are produced by the Groq function-calling path
// so the dashboard can render the planner's reasoning trail. Both are
// .default()ed so older persisted sessions deserialize cleanly.
export const ResearchStepSchema = z.object({
  action: z.enum(['call_service', 'synthesize', 'abort']),
  service: ResearchServiceNameSchema.optional(),
  // Free-form args the LLM populates (typically { tokenAddress } or { address }).
  // Validated per-service by the Producer route's JSON schema, so we keep it
  // loose here.
  serviceArgs: z.record(z.string(), z.unknown()).optional(),
  reason: z.string().min(5).max(500),
  confidence: z.number().min(0).max(1).default(0.5),
  expectedValue: z.string().max(500).default(''),
});
export type ResearchStep = z.infer<typeof ResearchStepSchema>;

// Self-graded retrospective evaluation of a single paid call, produced by
// the synthesize step. Attached to the ResearchCall after synthesis so the
// dashboard can show which paid calls earned their USDG.
export const CallGradeSchema = z.object({
  service: z.string(),
  usefulness: z.number().min(0).max(1),
  note: z.string().max(300),
});
export type CallGrade = z.infer<typeof CallGradeSchema>;

// A conflict the synthesizer noticed between two or more service results.
// `between` lists the service names that disagree, `note` explains the
// conflict in one sentence.
export const ContradictionSchema = z.object({
  between: z.array(z.string()).min(1),
  note: z.string().min(5).max(500),
});
export type Contradiction = z.infer<typeof ContradictionSchema>;

// LLM output when asked to synthesize the final answer from a session's
// accumulated service results. `confidence` is the coarse qualitative band
// kept for backward compat with existing dashboard consumers.
// `confidenceScore` is the new numeric [0,1] companion from the function
// calling refactor. `contradictions` and `callGrades` are also net-new.
export const ResearchSynthesisSchema = z.object({
  verdict: z.string().min(5).max(200),
  confidence: z.enum(['low', 'medium', 'high']),
  summary: z.string().min(20).max(2000),
  keyFacts: z.array(z.string()).max(10).default([]),
  confidenceScore: z.number().min(0).max(1).default(0.5),
  contradictions: z.array(ContradictionSchema).default([]),
  callGrades: z.array(CallGradeSchema).default([]),
});
export type ResearchSynthesis = z.infer<typeof ResearchSynthesisSchema>;

// One service call within a session: the service name, the args the LLM
// chose, the raw response (or error), and the x402 tx hash if settlement
// succeeded. The Consumer's session runner appends to this on every step.
//
// `planReason` + `planConfidence` + `planExpectedValue` capture the
// planner's rationale at the moment this call was dispatched so the
// dashboard can render a per-call justification trail.
// `grade` is attached retrospectively by the synthesize step.
export const ResearchCallSchema = z.object({
  service: ResearchServiceNameSchema,
  args: z.record(z.string(), z.unknown()),
  amountSpent: z.string(),
  txHash: z.string().nullable(),
  data: z.unknown().nullable(),
  error: z.string().nullable(),
  startedAt: z.number(),
  durationMs: z.number(),
  planReason: z.string().default(''),
  planConfidence: z.number().min(0).max(1).default(0.5),
  planExpectedValue: z.string().default(''),
  grade: CallGradeSchema.nullable().default(null),
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

// On-chain attestation metadata. Populated by the session runner after
// synthesize by calling CelinaAttestation.attest() on chain 196 with the
// keccak256 hash of the canonical verdict payload. `signature` is the
// personal-sign of the same payload from the Consumer's wallet (EIP-191)
// so anyone can recover the signer without touching the contract.
export const SessionAttestationSchema = z.object({
  sessionHash: z.string(),
  verdictHash: z.string(),
  signature: z.string(),
  signer: z.string(),
  txHash: z.string().nullable(),
  contractAddress: z.string(),
  attestedAt: z.number(),
});
export type SessionAttestation = z.infer<typeof SessionAttestationSchema>;

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
  attestation: SessionAttestationSchema.nullable().default(null),
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
  source: z.enum(['producer', 'consumer', 'subagent', 'orchestrator']),
  kind: z.string(),
  cycleNumber: z.number().nullable(),
  payload: z.record(z.string(), z.unknown()),
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;
