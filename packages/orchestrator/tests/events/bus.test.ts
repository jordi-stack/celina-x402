import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/migrate';
import { EventBus } from '../../src/events/bus';

describe('EventBus', () => {
  let db: Database.Database;
  let bus: EventBus;

  beforeEach(() => {
    db = new Database(':memory:');
    migrate(db);
    bus = new EventBus(db, 'consumer');
  });

  it('emit appends to audit_events table with auto-increment id', () => {
    bus.emit('LOOP_CYCLE_STARTED', { cycleNumber: 1 });
    const row = db
      .prepare(`SELECT * FROM audit_events ORDER BY id DESC LIMIT 1`)
      .get() as { id: number; kind: string; source: string; payload: string };
    expect(row.id).toBeGreaterThan(0);
    expect(row.kind).toBe('LOOP_CYCLE_STARTED');
    expect(row.source).toBe('consumer');
    expect(JSON.parse(row.payload)).toEqual({ cycleNumber: 1 });
  });

  it('emit extracts cycleNumber from payload', () => {
    bus.emit('DECISION_MADE', { cycleNumber: 42, action: 'consume_service' });
    const row = db
      .prepare(`SELECT cycle_number FROM audit_events WHERE kind = ?`)
      .get('DECISION_MADE') as { cycle_number: number };
    expect(row.cycle_number).toBe(42);
  });

  it('in-process subscribers receive emitted events synchronously', () => {
    const received: unknown[] = [];
    bus.on('SETTLEMENT_COMPLETED', (payload) => {
      received.push(payload);
    });
    bus.emit('SETTLEMENT_COMPLETED', { txHash: '0xABC', amount: '10000' });
    expect(received).toHaveLength(1);
    expect((received[0] as { txHash: string }).txHash).toBe('0xABC');
  });

  it('replay returns events after lastSeenId', () => {
    bus.emit('A', { n: 1 });
    bus.emit('B', { n: 2 });
    bus.emit('C', { n: 3 });
    const events = bus.replay({ sinceId: 1, limit: 10 });
    expect(events.length).toBeGreaterThanOrEqual(2);
    const kinds = events.map((e) => e.kind);
    expect(kinds).toContain('B');
    expect(kinds).toContain('C');
    expect(kinds).not.toContain('A');
  });

  it('different bus sources are distinguishable', () => {
    const producerBus = new EventBus(db, 'producer');
    producerBus.emit('SERVICE_REQUESTED', { service: 'market-snapshot' });
    const row = db
      .prepare(`SELECT source FROM audit_events WHERE kind = ?`)
      .get('SERVICE_REQUESTED') as { source: string };
    expect(row.source).toBe('producer');
  });
});
