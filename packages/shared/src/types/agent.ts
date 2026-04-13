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
