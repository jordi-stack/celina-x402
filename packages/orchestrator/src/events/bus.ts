import { EventEmitter } from 'node:events';
import type Database from 'better-sqlite3';

export type EventSource = 'producer' | 'consumer' | 'orchestrator';

export interface AuditEventRow {
  id: number;
  timestamp: number;
  source: string;
  kind: string;
  cycle_number: number | null;
  payload: string;
}

export interface ReplayEvent {
  id: number;
  timestamp: number;
  source: string;
  kind: string;
  cycleNumber: number | null;
  payload: Record<string, unknown>;
}

/**
 * Event bus with two channels:
 * 1. In-process EventEmitter for same-process subscribers (synchronous).
 * 2. SQLite audit_events append for cross-process durability + dashboard polling.
 */
export class EventBus {
  private readonly emitter = new EventEmitter();
  private readonly insertStmt: Database.Statement;

  constructor(
    private readonly db: Database.Database,
    private readonly source: EventSource
  ) {
    this.insertStmt = db.prepare(
      `INSERT INTO audit_events (timestamp, source, kind, cycle_number, payload) VALUES (?, ?, ?, ?, ?)`
    );
  }

  emit(kind: string, payload: Record<string, unknown>): void {
    const timestamp = Date.now();
    const cycleNumber =
      typeof payload.cycleNumber === 'number' ? payload.cycleNumber : null;
    this.insertStmt.run(timestamp, this.source, kind, cycleNumber, JSON.stringify(payload));
    this.emitter.emit(kind, payload);
  }

  on(kind: string, listener: (payload: Record<string, unknown>) => void): void {
    this.emitter.on(kind, listener);
  }

  off(kind: string, listener: (payload: Record<string, unknown>) => void): void {
    this.emitter.off(kind, listener);
  }

  replay(opts: { sinceId: number; limit: number }): ReplayEvent[] {
    const rows = this.db
      .prepare(`SELECT * FROM audit_events WHERE id > ? ORDER BY id LIMIT ?`)
      .all(opts.sinceId, opts.limit) as AuditEventRow[];
    return rows.map((r) => ({
      id: r.id,
      timestamp: r.timestamp,
      source: r.source,
      kind: r.kind,
      cycleNumber: r.cycle_number,
      payload: JSON.parse(r.payload) as Record<string, unknown>,
    }));
  }
}
