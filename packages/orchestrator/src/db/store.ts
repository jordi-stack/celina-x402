import type Database from 'better-sqlite3';
import type { CycleState, PaymentStatus } from '@x402/shared';

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
}
