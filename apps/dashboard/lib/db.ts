import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { migrate, Store, EventBus } from '@x402/orchestrator';

// Resolve data/app.db relative to the repo root so all three processes
// (Producer, Consumer, Dashboard) share the same SQLite file regardless of
// which directory they were launched from.
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(currentDir, '../../..');
const DB_PATH = process.env.APP_DB_PATH ?? path.join(REPO_ROOT, 'data/app.db');

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!dbInstance) {
    dbInstance = new Database(DB_PATH, { readonly: false });
    migrate(dbInstance);
  }
  return dbInstance;
}

export function getStore(): Store {
  return new Store(getDb());
}

export function getEventBus(): EventBus {
  return new EventBus(getDb(), 'orchestrator');
}
