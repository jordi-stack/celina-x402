import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/migrate';
import { tmpdir } from 'os';
import { join } from 'path';
import { unlinkSync, existsSync } from 'fs';

describe('migrate', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
  });

  it('creates all 5 tables on fresh database', () => {
    migrate(db);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];
    const names = tables.map((t) => t.name);
    expect(names).toContain('loop_cycles');
    expect(names).toContain('decisions');
    expect(names).toContain('payments');
    expect(names).toContain('mcp_calls');
    expect(names).toContain('audit_events');
  });

  // SQLite does not support WAL mode on :memory: databases (falls back to 'memory').
  // Use a temp file database to verify the pragma is applied correctly.
  it('enables WAL mode', () => {
    const tmpPath = join(tmpdir(), `migrate-wal-test-${Date.now()}.db`);
    let fileDb: Database.Database | undefined;
    try {
      fileDb = new Database(tmpPath);
      migrate(fileDb);
      const journal = fileDb.pragma('journal_mode', { simple: true }) as string;
      expect(journal).toBe('wal');
    } finally {
      fileDb?.close();
      if (existsSync(tmpPath)) unlinkSync(tmpPath);
      const walPath = tmpPath + '-wal';
      const shmPath = tmpPath + '-shm';
      if (existsSync(walPath)) unlinkSync(walPath);
      if (existsSync(shmPath)) unlinkSync(shmPath);
    }
  });

  it('creates required indexes', () => {
    migrate(db);
    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'")
      .all() as { name: string }[];
    const names = indexes.map((i) => i.name);
    expect(names).toContain('idx_audit_events_id');
    expect(names).toContain('idx_payments_cycle');
    expect(names).toContain('idx_decisions_cycle');
    expect(names).toContain('idx_payments_nonce');
  });

  it('is idempotent: calling migrate twice does not error', () => {
    migrate(db);
    expect(() => migrate(db)).not.toThrow();
  });

  it('enforces UNIQUE constraint on payments.nonce', () => {
    migrate(db);
    db.prepare(
      `INSERT INTO payments (cycle_number, scheme, nonce, from_addr, to_addr, amount_minimal, asset, service, signed_at, status)
       VALUES (1, 'exact', '0xNONCE1', '0xFROM', '0xTO', '1000', '0xUSDG', 'market-snapshot', 100, 'signed')`
    ).run();
    expect(() =>
      db.prepare(
        `INSERT INTO payments (cycle_number, scheme, nonce, from_addr, to_addr, amount_minimal, asset, service, signed_at, status)
         VALUES (2, 'exact', '0xNONCE1', '0xFROM2', '0xTO2', '2000', '0xUSDG', 'swap-quote', 200, 'signed')`
      ).run()
    ).toThrow(/UNIQUE constraint/);
  });
});
