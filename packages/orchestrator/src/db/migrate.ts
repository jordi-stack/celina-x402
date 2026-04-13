import type Database from 'better-sqlite3';
import { SCHEMA_STATEMENTS } from './schema';

/**
 * Apply schema migration to the given SQLite database.
 * Iterates SCHEMA_STATEMENTS and runs each via prepared statement.
 * Idempotent: safe to call on existing databases (CREATE TABLE IF NOT EXISTS).
 * Enables WAL mode for concurrent reader support.
 */
export function migrate(db: Database.Database): void {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  for (const ddl of SCHEMA_STATEMENTS) {
    db.prepare(ddl).run();
  }
}
