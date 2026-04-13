/**
 * SQLite DDL statements for x402-earn-pay-earn orchestrator.
 * Each entry is one standalone statement, run in order by migrate().
 * Tables + write ownership match spec Section 2 Component 3.
 */
export const SCHEMA_STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS loop_cycles (
    cycle_number INTEGER PRIMARY KEY,
    started_at INTEGER NOT NULL,
    completed_at INTEGER,
    state TEXT NOT NULL,
    retry_count INTEGER NOT NULL DEFAULT 0,
    net_usdg_change TEXT,
    decision_action TEXT,
    decision_reason TEXT,
    decision_model TEXT,
    state_transitions TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cycle_number INTEGER NOT NULL,
    scheme TEXT NOT NULL,
    nonce TEXT NOT NULL UNIQUE,
    from_addr TEXT NOT NULL,
    to_addr TEXT NOT NULL,
    amount_minimal TEXT NOT NULL,
    asset TEXT NOT NULL,
    service TEXT NOT NULL,
    signed_at INTEGER NOT NULL,
    verified_at INTEGER,
    settled_at INTEGER,
    tx_hash TEXT,
    status TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cycle_number INTEGER NOT NULL,
    timestamp INTEGER NOT NULL,
    action TEXT NOT NULL,
    reason TEXT NOT NULL,
    llm_response TEXT NOT NULL,
    model TEXT NOT NULL,
    latency_ms INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS mcp_calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    tool TEXT NOT NULL,
    args TEXT NOT NULL,
    result TEXT,
    duration_ms INTEGER NOT NULL,
    success INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS audit_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    source TEXT NOT NULL,
    kind TEXT NOT NULL,
    cycle_number INTEGER,
    payload TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_audit_events_id ON audit_events(id)`,
  `CREATE INDEX IF NOT EXISTS idx_payments_cycle ON payments(cycle_number)`,
  `CREATE INDEX IF NOT EXISTS idx_payments_nonce ON payments(nonce)`,
  `CREATE INDEX IF NOT EXISTS idx_decisions_cycle ON decisions(cycle_number)`,
];
