import type Database from 'better-sqlite3';
import { SCHEMA_STATEMENTS } from './schema';

/**
 * Apply schema migration to the given SQLite database.
 * Iterates SCHEMA_STATEMENTS and runs each via prepared statement.
 * Idempotent: safe to call on existing databases (CREATE TABLE IF NOT EXISTS).
 * Enables WAL mode for concurrent reader support.
 *
 * ALTER TABLE ... ADD COLUMN is NOT idempotent in SQLite — it throws
 * "duplicate column name: <col>" on second run. We swallow that specific
 * error so migrate() stays idempotent across fresh + existing databases.
 */
export function migrate(db: Database.Database): void {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  for (const ddl of SCHEMA_STATEMENTS) {
    try {
      db.prepare(ddl).run();
    } catch (err) {
      const msg = (err as Error).message;
      if (/duplicate column name/i.test(msg)) continue;
      throw err;
    }
  }
}
