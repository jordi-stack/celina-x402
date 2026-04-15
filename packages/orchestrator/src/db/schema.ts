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
  // Added 2026-04-15 for the Intelligence Agent pivot. One row per user
  // question that the Consumer reasons over. `calls` is a JSON array of
  // ResearchCall objects; `synthesis` is a JSON ResearchSynthesis or null
  // while still in-flight. CREATE IF NOT EXISTS keeps existing databases
  // safe — no data migration needed because no prior deploy has this table.
  `CREATE TABLE IF NOT EXISTS query_sessions (
    id TEXT PRIMARY KEY,
    question TEXT NOT NULL,
    status TEXT NOT NULL,
    calls TEXT NOT NULL,
    total_spent TEXT NOT NULL,
    synthesis TEXT,
    created_at INTEGER NOT NULL,
    completed_at INTEGER,
    error TEXT,
    attestation TEXT
  )`,
  // Added 2026-04-15 for Tier 0 #2 (on-chain attestation). ALTER is
  // no-op when the column already exists on fresh schemas; on older
  // DBs we catch the "duplicate column name" error in migrate().
  `ALTER TABLE query_sessions ADD COLUMN attestation TEXT`,
  // Added 2026-04-15 for Tier 1 #4 tiered pricing. Caches raw MCP results
  // by service+tokenAddress. On cache hit the Producer charges 50% price.
  // TTL is enforced at read time (caller checks cached_at + ttl_ms < now).
  `CREATE TABLE IF NOT EXISTS mcp_result_cache (
    cache_key TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    cached_at INTEGER NOT NULL,
    ttl_ms INTEGER NOT NULL
  )`,
  // Added 2026-04-15 for Tier 2 #12 self-grading. The synthesizer grades every
  // paid call 0..1 for usefulness. This table aggregates those grades per
  // service so the planner can bias toward high-performing services over time.
  `CREATE TABLE IF NOT EXISTS service_performance (
    service TEXT PRIMARY KEY,
    call_count INTEGER NOT NULL DEFAULT 0,
    useful_count INTEGER NOT NULL DEFAULT 0,
    wasted_count INTEGER NOT NULL DEFAULT 0,
    total_usefulness REAL NOT NULL DEFAULT 0,
    last_used INTEGER
  )`,
  // Added 2026-04-15 for Tier 2 #11 agent memory + dedup. Each completed
  // session writes a row with its embedding vector so future queries can
  // check cosine similarity and skip re-paying for duplicate research.
  // embedding is a JSON float32 array (384 dims, all-MiniLM-L6-v2).
  // expires_at = created_at + 24h; rows past expiry are ignored at read time.
  `CREATE TABLE IF NOT EXISTS session_memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    question TEXT NOT NULL,
    embedding TEXT,
    extracted_addresses TEXT NOT NULL,
    verdict TEXT NOT NULL,
    confidence_score REAL NOT NULL,
    total_spent TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_session_memory_expires ON session_memory(expires_at)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_events_id ON audit_events(id)`,
  `CREATE INDEX IF NOT EXISTS idx_payments_cycle ON payments(cycle_number)`,
  `CREATE INDEX IF NOT EXISTS idx_payments_nonce ON payments(nonce)`,
  `CREATE INDEX IF NOT EXISTS idx_decisions_cycle ON decisions(cycle_number)`,
  `CREATE INDEX IF NOT EXISTS idx_query_sessions_created ON query_sessions(created_at DESC)`,
];
