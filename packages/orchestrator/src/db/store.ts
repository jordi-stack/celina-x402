import type Database from 'better-sqlite3';
import type {
  CycleState,
  PaymentStatus,
  ResearchCall,
  ResearchSession,
  ResearchSessionStatus,
  ResearchSynthesis,
} from '@x402/shared';
import {
  ResearchCallSchema,
  ResearchSynthesisSchema,
  SessionAttestationSchema,
  type SessionAttestation,
} from '@x402/shared';

export interface LoopCycleRow {
  cycle_number: number;
  started_at: number;
  completed_at: number | null;
  state: string;
  retry_count: number;
  net_usdg_change: string | null;
  decision_action: string | null;
  decision_reason: string | null;
  decision_model: string | null;
  state_transitions: string | null;
}

export interface PaymentRow {
  id: number;
  cycle_number: number;
  scheme: string;
  nonce: string;
  from_addr: string;
  to_addr: string;
  amount_minimal: string;
  asset: string;
  service: string;
  signed_at: number;
  verified_at: number | null;
  settled_at: number | null;
  tx_hash: string | null;
  status: string;
}

export interface DecisionRow {
  id: number;
  cycle_number: number;
  timestamp: number;
  action: string;
  reason: string;
  llm_response: string;
  model: string;
  latency_ms: number | null;
}

export interface McpCallRow {
  id: number;
  timestamp: number;
  tool: string;
  args: string;
  result: string | null;
  duration_ms: number;
  success: number;
}

export interface QuerySessionRow {
  id: string;
  question: string;
  status: string;
  calls: string;
  total_spent: string;
  synthesis: string | null;
  created_at: number;
  completed_at: number | null;
  error: string | null;
  attestation: string | null;
}

export interface MemoryRow {
  id: number;
  sessionId: string;
  question: string;
  embedding: number[] | null;
  extractedAddresses: string[];
  verdict: string;
  confidenceScore: number;
  totalSpent: string;
  createdAt: number;
  expiresAt: number;
}

export interface ServiceStat {
  service: string;
  callCount: number;
  usefulCount: number;
  wastedCount: number;
  avgUsefulness: number;
  lastUsed: number | null;
}

export class Store {
  constructor(private readonly db: Database.Database) {}

  insertCycle(opts: { cycleNumber: number; startedAt: number }): LoopCycleRow {
    this.db
      .prepare(
        `INSERT INTO loop_cycles (cycle_number, started_at, state, retry_count, state_transitions)
         VALUES (?, ?, 'IDLE', 0, ?)`
      )
      .run(opts.cycleNumber, opts.startedAt, JSON.stringify(['IDLE']));
    return this.getCycle(opts.cycleNumber)!;
  }

  updateCycleState(cycleNumber: number, nextState: CycleState): void {
    const current = this.getCycle(cycleNumber);
    if (!current) throw new Error(`Cycle ${cycleNumber} not found`);
    const transitions = current.state_transitions
      ? (JSON.parse(current.state_transitions) as string[])
      : [];
    transitions.push(nextState);
    this.db
      .prepare(`UPDATE loop_cycles SET state = ?, state_transitions = ? WHERE cycle_number = ?`)
      .run(nextState, JSON.stringify(transitions), cycleNumber);
  }

  completeCycle(
    cycleNumber: number,
    opts: { completedAt: number; netUsdgChange: string }
  ): void {
    this.db
      .prepare(
        `UPDATE loop_cycles
         SET state = 'COMPLETED', completed_at = ?, net_usdg_change = ?
         WHERE cycle_number = ?`
      )
      .run(opts.completedAt, opts.netUsdgChange, cycleNumber);
  }

  getCycle(cycleNumber: number): LoopCycleRow | null {
    return (
      (this.db
        .prepare(`SELECT * FROM loop_cycles WHERE cycle_number = ?`)
        .get(cycleNumber) as LoopCycleRow | undefined) ?? null
    );
  }

  getCurrentCycle(): LoopCycleRow | null {
    return (
      (this.db
        .prepare(`SELECT * FROM loop_cycles ORDER BY cycle_number DESC LIMIT 1`)
        .get() as LoopCycleRow | undefined) ?? null
    );
  }

  insertPendingPayment(opts: {
    cycleNumber: number;
    scheme: string;
    nonce: string;
    fromAddr: string;
    toAddr: string;
    amountMinimal: string;
    asset: string;
    service: string;
    signedAt: number;
  }): PaymentRow {
    this.db
      .prepare(
        `INSERT INTO payments
         (cycle_number, scheme, nonce, from_addr, to_addr, amount_minimal, asset, service, signed_at, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'signed')`
      )
      .run(
        opts.cycleNumber,
        opts.scheme,
        opts.nonce,
        opts.fromAddr,
        opts.toAddr,
        opts.amountMinimal,
        opts.asset,
        opts.service,
        opts.signedAt
      );
    return this.findPaymentByNonce(opts.nonce)!;
  }

  updateSettlement(
    nonce: string,
    opts: { txHash: string | null; settledAt: number; status: PaymentStatus }
  ): void {
    this.db
      .prepare(
        `UPDATE payments
         SET tx_hash = ?, settled_at = ?, status = ?
         WHERE nonce = ?`
      )
      .run(opts.txHash, opts.settledAt, opts.status, nonce);
  }

  updateVerification(nonce: string, verifiedAt: number): void {
    this.db
      .prepare(`UPDATE payments SET verified_at = ?, status = 'verified' WHERE nonce = ?`)
      .run(verifiedAt, nonce);
  }

  findPaymentByNonce(nonce: string): PaymentRow | null {
    return (
      (this.db
        .prepare(`SELECT * FROM payments WHERE nonce = ?`)
        .get(nonce) as PaymentRow | undefined) ?? null
    );
  }

  findNonTerminalPayments(): PaymentRow[] {
    return this.db
      .prepare(`SELECT * FROM payments WHERE status IN ('signed', 'verified') ORDER BY signed_at`)
      .all() as PaymentRow[];
  }

  insertDecision(opts: {
    cycleNumber: number;
    timestamp: number;
    action: string;
    reason: string;
    llmResponse: string;
    model: string;
    latencyMs: number;
  }): void {
    this.db
      .prepare(
        `INSERT INTO decisions (cycle_number, timestamp, action, reason, llm_response, model, latency_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        opts.cycleNumber,
        opts.timestamp,
        opts.action,
        opts.reason,
        opts.llmResponse,
        opts.model,
        opts.latencyMs
      );
  }

  getDecisionsByCycle(cycleNumber: number): DecisionRow[] {
    return this.db
      .prepare(`SELECT * FROM decisions WHERE cycle_number = ? ORDER BY timestamp`)
      .all(cycleNumber) as DecisionRow[];
  }

  logMcpCall(opts: {
    timestamp: number;
    tool: string;
    args: Record<string, unknown>;
    result: unknown;
    durationMs: number;
    success: boolean;
  }): void {
    this.db
      .prepare(
        `INSERT INTO mcp_calls (timestamp, tool, args, result, duration_ms, success)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        opts.timestamp,
        opts.tool,
        JSON.stringify(opts.args),
        JSON.stringify(opts.result),
        opts.durationMs,
        opts.success ? 1 : 0
      );
  }

  getMcpCalls(opts: { limit: number }): (Omit<McpCallRow, 'success'> & { success: boolean })[] {
    const rows = this.db
      .prepare(`SELECT * FROM mcp_calls ORDER BY timestamp DESC LIMIT ?`)
      .all(opts.limit) as McpCallRow[];
    return rows.map((r) => ({ ...r, success: Boolean(r.success) }));
  }

  // ---------------------------------------------------------------------------
  // MCP result cache (Tier 1 #4 tiered pricing)
  // ---------------------------------------------------------------------------

  getCachedResult(cacheKey: string): unknown | null {
    const row = this.db
      .prepare(`SELECT data, cached_at, ttl_ms FROM mcp_result_cache WHERE cache_key = ?`)
      .get(cacheKey) as { data: string; cached_at: number; ttl_ms: number } | undefined;
    if (!row) return null;
    if (Date.now() > row.cached_at + row.ttl_ms) return null; // expired
    return JSON.parse(row.data) as unknown;
  }

  isCacheHit(cacheKey: string): boolean {
    return this.getCachedResult(cacheKey) !== null;
  }

  // ---------------------------------------------------------------------------
  // Service performance (Tier 2 #12 self-grading)
  // ---------------------------------------------------------------------------

  recordServiceGrades(grades: Array<{ service: string; usefulness: number }>): void {
    const stmt = this.db.prepare(`
      INSERT INTO service_performance (service, call_count, useful_count, wasted_count, total_usefulness, last_used)
      VALUES (?, 1, ?, ?, ?, ?)
      ON CONFLICT(service) DO UPDATE SET
        call_count = call_count + 1,
        useful_count = useful_count + excluded.useful_count,
        wasted_count = wasted_count + excluded.wasted_count,
        total_usefulness = total_usefulness + excluded.total_usefulness,
        last_used = excluded.last_used
    `);
    const now = Date.now();
    const run = this.db.transaction(
      (gs: Array<{ service: string; usefulness: number }>) => {
        for (const g of gs) {
          stmt.run(
            g.service,
            g.usefulness >= 0.7 ? 1 : 0,
            g.usefulness < 0.3 ? 1 : 0,
            g.usefulness,
            now
          );
        }
      }
    );
    run(grades);
  }

  getServiceStats(): ServiceStat[] {
    interface Row {
      service: string;
      call_count: number;
      useful_count: number;
      wasted_count: number;
      total_usefulness: number;
      last_used: number | null;
    }
    const rows = this.db
      .prepare(`SELECT * FROM service_performance ORDER BY call_count DESC`)
      .all() as Row[];
    return rows.map((r) => ({
      service: r.service,
      callCount: r.call_count,
      usefulCount: r.useful_count,
      wastedCount: r.wasted_count,
      avgUsefulness: r.call_count > 0 ? r.total_usefulness / r.call_count : 0,
      lastUsed: r.last_used,
    }));
  }

  // ---------------------------------------------------------------------------
  // Session memory (Tier 2 #11 agent memory + dedup)
  // ---------------------------------------------------------------------------

  insertMemory(opts: {
    sessionId: string;
    question: string;
    embedding: number[] | null;
    extractedAddresses: string[];
    verdict: string;
    confidenceScore: number;
    totalSpent: string;
    ttlMs?: number;
  }): void {
    const now = Date.now();
    const ttl = opts.ttlMs ?? 24 * 60 * 60 * 1000; // 24h default
    this.db
      .prepare(
        `INSERT OR REPLACE INTO session_memory
         (session_id, question, embedding, extracted_addresses, verdict, confidence_score, total_spent, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        opts.sessionId,
        opts.question,
        opts.embedding ? JSON.stringify(opts.embedding) : null,
        JSON.stringify(opts.extractedAddresses),
        opts.verdict,
        opts.confidenceScore,
        opts.totalSpent,
        now,
        now + ttl
      );
  }

  listActiveMemories(): MemoryRow[] {
    const now = Date.now();
    interface Row {
      id: number;
      session_id: string;
      question: string;
      embedding: string | null;
      extracted_addresses: string;
      verdict: string;
      confidence_score: number;
      total_spent: string;
      created_at: number;
      expires_at: number;
    }
    const rows = this.db
      .prepare(`SELECT * FROM session_memory WHERE expires_at > ? ORDER BY created_at DESC`)
      .all(now) as Row[];
    return rows.map((r) => ({
      id: r.id,
      sessionId: r.session_id,
      question: r.question,
      embedding: r.embedding ? (JSON.parse(r.embedding) as number[]) : null,
      extractedAddresses: JSON.parse(r.extracted_addresses) as string[],
      verdict: r.verdict,
      confidenceScore: r.confidence_score,
      totalSpent: r.total_spent,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
    }));
  }

  setCachedResult(cacheKey: string, data: unknown, ttlMs: number): void {
    this.db
      .prepare(
        `INSERT INTO mcp_result_cache (cache_key, data, cached_at, ttl_ms)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(cache_key) DO UPDATE SET data = excluded.data, cached_at = excluded.cached_at, ttl_ms = excluded.ttl_ms`
      )
      .run(cacheKey, JSON.stringify(data), Date.now(), ttlMs);
  }

  insertQuerySession(session: ResearchSession): void {
    this.db
      .prepare(
        `INSERT INTO query_sessions
         (id, question, status, calls, total_spent, synthesis, created_at, completed_at, error, attestation)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        session.id,
        session.question,
        session.status,
        JSON.stringify(session.calls),
        session.totalSpent,
        session.synthesis ? JSON.stringify(session.synthesis) : null,
        session.createdAt,
        session.completedAt,
        session.error,
        session.attestation ? JSON.stringify(session.attestation) : null
      );
  }

  updateQuerySession(
    id: string,
    patch: {
      status?: ResearchSessionStatus;
      calls?: ResearchCall[];
      totalSpent?: string;
      synthesis?: ResearchSynthesis | null;
      completedAt?: number | null;
      error?: string | null;
      attestation?: SessionAttestation | null;
    }
  ): void {
    const sets: string[] = [];
    const args: unknown[] = [];
    if (patch.status !== undefined) {
      sets.push('status = ?');
      args.push(patch.status);
    }
    if (patch.calls !== undefined) {
      sets.push('calls = ?');
      args.push(JSON.stringify(patch.calls));
    }
    if (patch.totalSpent !== undefined) {
      sets.push('total_spent = ?');
      args.push(patch.totalSpent);
    }
    if (patch.synthesis !== undefined) {
      sets.push('synthesis = ?');
      args.push(patch.synthesis ? JSON.stringify(patch.synthesis) : null);
    }
    if (patch.completedAt !== undefined) {
      sets.push('completed_at = ?');
      args.push(patch.completedAt);
    }
    if (patch.error !== undefined) {
      sets.push('error = ?');
      args.push(patch.error);
    }
    if (patch.attestation !== undefined) {
      sets.push('attestation = ?');
      args.push(patch.attestation ? JSON.stringify(patch.attestation) : null);
    }
    if (sets.length === 0) return;
    args.push(id);
    this.db
      .prepare(`UPDATE query_sessions SET ${sets.join(', ')} WHERE id = ?`)
      .run(...args);
  }

  getQuerySession(id: string): ResearchSession | null {
    const row = this.db
      .prepare(`SELECT * FROM query_sessions WHERE id = ?`)
      .get(id) as QuerySessionRow | undefined;
    return row ? hydrateQuerySession(row) : null;
  }

  listRecentQuerySessions(limit: number): ResearchSession[] {
    const rows = this.db
      .prepare(`SELECT * FROM query_sessions ORDER BY created_at DESC LIMIT ?`)
      .all(limit) as QuerySessionRow[];
    return rows.map(hydrateQuerySession);
  }
}

function hydrateQuerySession(row: QuerySessionRow): ResearchSession {
  // Zod parse so .default()s on newly-added ResearchCall/ResearchSynthesis
  // fields (planReason, planConfidence, planExpectedValue, grade,
  // confidenceScore, contradictions, callGrades) backfill cleanly for
  // legacy rows that were written before the function-calling refactor.
  const rawCalls = JSON.parse(row.calls) as unknown[];
  const calls = rawCalls.map((c) => ResearchCallSchema.parse(c));
  const synthesis = row.synthesis
    ? ResearchSynthesisSchema.parse(JSON.parse(row.synthesis))
    : null;
  const attestation = row.attestation
    ? SessionAttestationSchema.parse(JSON.parse(row.attestation))
    : null;
  return {
    id: row.id,
    question: row.question,
    status: row.status as ResearchSessionStatus,
    calls,
    totalSpent: row.total_spent,
    synthesis,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    error: row.error,
    attestation,
  };
}
