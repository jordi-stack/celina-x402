# x402 Earn-Pay-Earn Design Spec

**Status:** Approved (all 4 sections complete, spec review passed)
**Date:** 2026-04-13
**Hackathon:** OKX Build X, I'm Human track, X Layer Arena
**Deadline:** 2026-04-15 23:59 UTC

## Project Identity

- **Working name:** `x402-earn-pay-earn`
- **Thesis:** Full-stack agentic app demonstrating genuine economy loop — agent earns USDG on X Layer via x402 paid services, consumes other x402 services with earned funds, closing the loop autonomously with zero gas.
- **Arena:** X Layer Arena (full-stack agentic app)
- **Track:** I'm Human

## Demo Persona and Narrative

**Persona:** Aria, a DeFi Research Agent running on X Layer. Aria's job is to scout token opportunities without burning her owner's capital on random RPC lookups. To stay self-sufficient, she also offers her research outputs to other agents as paid services.

**60-second pitch:**
> Aria wakes up with 10 USDG on X Layer. She needs to research tokens but every data source costs money — so she turns her existing research library into paid services via x402. As other agents pay her for market snapshots and swap quotes, her balance grows. She uses that earned budget to consume her own (or other) services for deeper reconnaissance, closing the loop. Watch her balance rise and fall in real-time as she autonomously earns and pays — the first true agentic economy running on X Layer.

**Why it works as a demo:**
- Relatable character (intelligent agent, not abstract "service")
- Clear before/after: watch balance trajectory on dashboard
- Real money on real X Layer mainnet (tx hashes clickable to explorer)
- Loop visible in dashboard velocity gauge
- Narrative ending: "Aria is now self-sufficient. She could run forever on zero gas."

## Prize Targets

Main prize realistic: 2nd-3rd tier (2000-1000 USDT)

Special prizes (500 USDT each, stackable):
- Best x402 application — core mechanism fit
- Best economy loop — literal earn-pay-earn cycle
- Best MCP integration — MCP-first architecture (verified 2026-04-13)
- Most active agent — verified 1s block time enables 12-20 cycles/min demo

**Stretch target:** 3500-6500 USDT (main + 2-3 special stacked)
**Honest score midpoint:** 87-92/100

---

## Section 1: Architecture Overview

### Core Thesis

Full-stack agentic app on X Layer demonstrating complete economy loop:
1. Producer agent hosts paid HTTP services, charges via x402 in USDG
2. Consumer agent reasons about which service to consume, signs x402 payment via TEE, replays HTTP request
3. Producer verifies + settles via OKX Facilitator, delivers resource
4. Consumer ingests resource, feeds back to reasoner for next decision
5. Loop closes on X Layer with zero gas for USDG/USDT

### Verified Architecture Foundations

All these facts are verified via live query (see memory files):

| Fact | Source | Impact |
|---|---|---|
| X Layer has no public mempool | Live RPC test (rpc.xlayer.tech) | Sandwich/MEV non-issue, simpler flow |
| X Layer block time = 1.00s | Live measured 100 blocks in 100s | Loop velocity 12-20 cycles/min feasible |
| Zero gas for USDG/USDT on X Layer | OnchainOS Payments docs | Loop economics free |
| x402 native on X Layer (`eip155:196`) | supported-networks.md | No cross-chain workaround needed |
| Uniswap NOT deployed on X Layer | Live eth_getCode on canonical addresses | Skip Uniswap integration, skip Best Uniswap prize (not this arena) |
| OKX Facilitator REST API exists | payment-settlement.md + payment-verification.md | Seller side outsourced to OKX |
| OKX MCP Server exists (unified Trade+Market+Balance) | dex-ai-tools-mcp-server.md + market-ai-tools-mcp-server.md | MCP-first architecture enables Best MCP Integration prize |
| Agentic Wallet supports multi-account natively | agentic-wallet CLI reference | One login → Producer + Consumer accounts |
| Groq llama-3.3-70b-versatile rate limits | console.groq.com/docs/rate-limits | 30 RPM, 1K RPD sufficient for demo scope |

### Two-Agent Topology

```
┌────────────────────────────────────────────────────────────┐
│  x402-earn-pay-earn App (deployed on X Layer)              │
│                                                            │
│  Single OKX Agentic Wallet login                           │
│  ├─ Account 1: Consumer (Buyer role)                       │
│  └─ Account 2: Producer (Seller role)                      │
│                                                            │
│  ┌──────────────────┐         ┌──────────────────┐         │
│  │  Producer Agent  │◄───────►│  Consumer Agent  │         │
│  │  (Fastify HTTP)  │  loop   │  (Node script)   │         │
│  └────────┬─────────┘         └────────┬─────────┘         │
│           │                            │                   │
│           │ Data source:               │ Signing:          │
│           │ OKX MCP Server HTTP        │ okx-x402-payment  │
│           │ (quote, price-info)        │ CLI (TEE)         │
│           │                            │                   │
│           │ Settlement:                │ Execute:          │
│           │ Facilitator /verify        │ HTTP replay with  │
│           │ + /settle (HMAC signed)    │ PAYMENT-SIGNATURE │
│           └──────┬─────────────┬───────┘                   │
│                  │             │                           │
│                  ▼             ▼                           │
│  ┌──────────────────────────────────────────────────┐      │
│  │  Orchestration Layer                             │      │
│  │  - Event bus (in-process pub/sub)                │      │
│  │  - SQLite state store                            │      │
│  │  - Groq LLM reasoner (llama-3.3-70b primary)     │      │
│  │  - Rate limit adaptive throttler                 │      │
│  │  - Loop state machine                            │      │
│  └──────────────────────────────────────────────────┘      │
│                          │                                 │
│                          ▼                                 │
│  ┌──────────────────────────────────────────────────┐      │
│  │  Dashboard (Next.js 14 App Router)               │      │
│  │  - Live loop status + velocity                   │      │
│  │  - Dual-account balance view                     │      │
│  │  - Tx log with X Layer explorer links            │      │
│  │  - MCP call trace                                │      │
│  │  - LLM reasoning live view                       │      │
│  └──────────────────────────────────────────────────┘      │
└────────────────────────────────────────────────────────────┘
         │                  │                    │
         ▼                  ▼                    ▼
┌────────────────┐  ┌───────────────┐  ┌──────────────────────┐
│  X Layer Chain │  │  OKX          │  │  OKX OnchainOS       │
│  (eip155:196)  │  │  Facilitator  │  │  MCP Server          │
│  ~1s blocks    │  │  /verify      │  │  /api/v1/            │
│  Zero gas USDG │  │  /settle      │  │  onchainos-mcp       │
└────────────────┘  └───────────────┘  └──────────────────────┘
```

### Tech Stack (all committed)

| Layer | Choice | Justification |
|---|---|---|
| Workspace | pnpm workspaces | Zero config, fits hackathon velocity |
| Language | TypeScript | Type safety across monorepo |
| Runtime | Node.js 20+ | Matches OnchainOS CLI requirements |
| HTTP server | Fastify | JSON schema validation + TypeScript-first |
| Frontend | Next.js 14 + Tailwind + shadcn/ui | Polished, SSR benefit, fast setup |
| State store | SQLite via better-sqlite3 | Zero infra, durable, queryable |
| LLM | Groq llama-3.3-70b-versatile (primary), llama-3.1-8b-instant (fast pricing) | Fast, open-source, free tier sufficient |
| Testing | Vitest | Modern, fast, TypeScript-native |
| X Layer ops | OKX Agentic Wallet CLI + okx-x402-payment CLI | Canonical skills, no reinvent |
| Producer data | OKX MCP Server HTTP (MCP-first) | Best MCP Integration prize fit |
| Trenches | okx-dex-trenches CLI (MCP not available) | Hybrid fallback |

### Key Architecture Decisions

**Decision 1: Single login, two accounts**
One OKX Developer Portal API key. Login once, run `wallet add` to create Account 2. Consumer uses Account 1, Producer uses Account 2. Switch via `wallet switch <accountId>`.

**Decision 2: MCP-first for market + swap services**
- `market-snapshot` → MCP `dex-okx-market-token-price-info` (HTTP JSON-RPC)
- `swap-quote` → MCP `dex-okx-dex-quote` (HTTP JSON-RPC)
- `trench-scan` → CLI `okx-dex-trenches` (MCP does not cover trenches)

**Decision 3: `exact` scheme for x402 settlement**
Each payment = one on-chain tx with verifiable txHash. Strong for Most Active Agent prize claim and demo visibility.

**Decision 4: Loop velocity target 12-20 cycles/min**
Bottlenecks: LLM reasoning (~0.7-1s), tx confirmation (~1-2s), HTTP roundtrip (~0.5s). Realistic per-cycle: 3-5 seconds.

---

## Section 2: Component Specification

### Monorepo Structure

```
x402-earn-pay-earn/
├── .gitignore                    (protects .env)
├── .env.example                  (template with Groq + OKX keys)
├── README.md                     (hackathon submission root)
├── package.json                  (pnpm workspace root)
├── pnpm-workspace.yaml
├── docs/
│   ├── superpowers/specs/        (design docs)
│   ├── architecture.md
│   ├── api-reference.md
│   └── demo-scenarios.md
├── apps/
│   ├── dashboard/                (Next.js 14 frontend)
│   ├── producer/                 (Fastify HTTP service, Seller agent)
│   └── consumer/                 (Node script, Buyer agent)
├── packages/
│   ├── shared/                   (cross-app TypeScript types + constants)
│   ├── orchestrator/             (event bus + state store + state machine)
│   ├── mcp-client/               (OKX MCP Server JSON-RPC client)
│   ├── okx-auth/                 (HMAC signing utility for Facilitator API)
│   └── onchain-clients/          (CLI wrappers for wallet + x402-payment)
├── scripts/
│   ├── setup-wallets.sh          (login + wallet add for 2 accounts)
│   ├── demo-runner.ts            (orchestrated demo scenario)
│   └── health-check.ts           (pre-flight validation)
└── tests/
    ├── integration/
    └── unit/
```

### Component 1: Producer Agent (Seller)

**Responsibilities:**
1. Expose HTTP endpoints for 3 paid services
2. Return 402 with `accepts` array on unauthorized requests
3. Verify `PAYMENT-SIGNATURE` via Facilitator `/verify`
4. Settle via Facilitator `/settle` after resource delivery
5. Emit orchestrator events

**Endpoints:**

| Endpoint | Price | Backend | OnchainOS integration |
|---|---|---|---|
| `POST /v1/market-snapshot` | 0.01 USDG | MCP `dex-okx-market-token-price-info` | MCP HTTP |
| `POST /v1/trench-scan` | 0.02 USDG | CLI `onchainos memepump token-dev-info` | child_process |
| `POST /v1/swap-quote` | 0.015 USDG | MCP `dex-okx-dex-quote` | MCP HTTP |

**x402-gate as Fastify plugin (uses native hooks, not Express middleware):**

All x402 header names are pinned to OKX x402 v2 as documented in `okx-x402-payment/SKILL.md`: server returns `PAYMENT-REQUIRED` (402 header), client sends `PAYMENT-SIGNATURE` (200 request header). No v1 (`X-PAYMENT`) fallback in this project — we target v2 exclusively.

```typescript
// apps/producer/src/plugins/x402-gate.ts
import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

interface X402RouteOptions {
  amount: string;       // USDG minimal units, e.g. "10000" for 0.01 USDG
  service: string;      // service name for audit log
  asset: string;        // token contract address
}

declare module 'fastify' {
  interface FastifyRequest {
    paymentProof?: PaymentPayload;
    payer?: string;
    x402Opts?: X402RouteOptions;
  }
}

const x402GatePlugin: FastifyPluginAsync = async (fastify) => {
  // preHandler: run before the route handler, checks payment header and verifies via Facilitator
  fastify.addHook('preHandler', async (request, reply) => {
    const opts = request.routeOptions.config?.x402 as X402RouteOptions | undefined;
    if (!opts) return; // route not x402-gated

    const paymentHeader = request.headers['payment-signature'] as string | undefined;

    if (!paymentHeader) {
      const payload = encode402Payload({
        x402Version: 2,
        resource: { url: request.url, description: opts.service, mimeType: 'application/json' },
        accepts: [{
          scheme: 'exact',
          network: 'eip155:196',
          amount: opts.amount,
          asset: opts.asset,
          payTo: process.env.PRODUCER_ADDRESS!,
          maxTimeoutSeconds: 60,
          extra: { name: 'USDG', version: '2' },
        }],
      });
      reply.code(402).header('PAYMENT-REQUIRED', payload).send({});
      return reply; // short-circuit
    }

    const decoded = decodePaymentPayload(paymentHeader);
    const verifyResult = await facilitator.verify(decoded, opts);

    if (!verifyResult.isValid) {
      reply.code(402).send({ error: verifyResult.invalidMessage });
      return reply;
    }

    request.paymentProof = decoded;
    request.payer = verifyResult.payer;
    request.x402Opts = opts;
    // Record pending payment row in SQLite so Producer can update settlement later
    await orchestrator.recordPendingPayment({
      cycleNumber: decoded.payload.authorization.nonce,
      decoded,
      opts,
    });
  });

  // onResponse: fires AFTER the response has been sent to the client, safe to settle async
  fastify.addHook('onResponse', async (request, reply) => {
    if (!request.paymentProof || !request.x402Opts || reply.statusCode !== 200) return;

    try {
      const settleResult = await facilitator.settle(request.paymentProof, request.x402Opts);
      await orchestrator.recordSettlement({
        nonce: request.paymentProof.payload.authorization.nonce,
        txHash: settleResult.transaction,
        status: settleResult.status,
      });
      orchestrator.emit('SETTLEMENT_COMPLETED', settleResult);
    } catch (e) {
      await orchestrator.recordSettlementFailure({ nonce: request.paymentProof.payload.authorization.nonce, error: e });
      // Background retry task will pick it up (see Section 4.2)
    }
  });
};

export default fp(x402GatePlugin);
```

**Route registration:**
```typescript
fastify.post('/v1/market-snapshot', {
  config: { x402: { amount: '10000', service: 'market-snapshot', asset: USDG_CONTRACT } },
  schema: { /* Fastify JSON schema validation */ },
}, async (request, reply) => {
  const data = await mcpClient.getTokenPriceInfo(request.body);
  return data;
});
```

**Fastify hook order:** `preHandler` (verify) → route handler (serve resource) → `onResponse` (settle async). This matches Fastify's documented lifecycle and guarantees settlement happens AFTER the response has been flushed to the client. No Express-style `res.on('finish')` race condition.

### Component 2: Consumer Agent (Buyer)

**Responsibilities:**
1. Budget-aware decision making (current balance, spend velocity)
2. LLM reasoning: which Producer service to call next, why
3. Execute x402 flow: detect 402 → parse accepts → sign via CLI → replay
4. Ingest returned resource, feed to reasoner for next decision
5. Emit orchestrator events

**Reasoner prompt skeleton:**
```
You are an autonomous agent with a USDG budget on X Layer (chain 196).
Your objective: earn and spend strategically to maintain balance and demonstrate
an economy loop.

CURRENT STATE:
- USDG balance: {balance}
- Recent earnings (last 5 cycles): {earnings}
- Recent spends (last 5 cycles): {spends}
- Available services: market-snapshot ($0.01), trench-scan ($0.02), swap-quote ($0.015)

POLICY:
- Never spend below 0.5 USDG
- Target loop velocity: 15 cycles/min
- Prefer decision pipeline: market-snapshot → trench-scan → swap-quote (logical sequence)

DECIDE the next action. Respond JSON: { action, reason, expected_benefit }
```

**CLI wrapping pattern:**
```typescript
async function signX402Payment(accepts: Accept[]): Promise<PaymentProof> {
  const cli = spawn('onchainos', ['payment', 'x402-pay', '--accepts', JSON.stringify(accepts)]);
  const output = await collectOutput(cli);
  return parsePaymentProof(output);
}
```

### Component 3: Orchestration Layer

**Event bus events:**
- `SERVICE_REQUESTED { service, requester }`
- `PAYMENT_VERIFIED { payer, amount, resource }`
- `SETTLEMENT_COMPLETED { txHash, amount, status }`
- `DECISION_MADE { action, reason, timestamp }`
- `LOOP_CYCLE_STARTED { cycleNumber }`
- `LOOP_CYCLE_COMPLETED { cycleNumber, netBalance }`
- `POLICY_VIOLATION { rule, attempted_action }`
- `MCP_CALL { tool, duration_ms, success }`
- `LLM_DECISION { model, prompt_tokens, completion_tokens, latency_ms }`

**SQLite tables (with explicit schemas and writer ownership):**

```sql
-- Written by Consumer process
CREATE TABLE loop_cycles (
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
);

-- Written by Consumer (pending row on sign) + Producer (updates settlement fields on /settle response)
CREATE TABLE payments (
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
  status TEXT NOT NULL  -- signed, verified, settled, settle_failed, settle_abandoned
);

-- Written by Consumer process
CREATE TABLE decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cycle_number INTEGER NOT NULL,
  timestamp INTEGER NOT NULL,
  action TEXT NOT NULL,
  reason TEXT NOT NULL,
  llm_response TEXT NOT NULL,
  model TEXT NOT NULL,
  latency_ms INTEGER
);

-- Written by Producer process
CREATE TABLE mcp_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,
  tool TEXT NOT NULL,
  args TEXT NOT NULL,
  result TEXT,
  duration_ms INTEGER NOT NULL,
  success INTEGER NOT NULL
);

-- Written by any process via shared orchestrator library helper
CREATE TABLE audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,
  source TEXT NOT NULL,         -- 'producer' | 'consumer' | 'orchestrator'
  kind TEXT NOT NULL,           -- event type name
  cycle_number INTEGER,
  payload TEXT NOT NULL         -- JSON blob
);

CREATE INDEX idx_audit_events_id ON audit_events(id);
CREATE INDEX idx_payments_cycle ON payments(cycle_number);
CREATE INDEX idx_decisions_cycle ON decisions(cycle_number);
```

**Writer ownership (single-writer per table or append-only where shared):**
- Consumer process: `loop_cycles`, `decisions`, `payments` (inserts pending row on sign)
- Producer process: `mcp_calls`, `payments` (updates `verified_at`, `settled_at`, `tx_hash`, `status` via UPDATE WHERE nonce=?)
- Both processes: `audit_events` (append-only via autoincrement id, no conflict)

SQLite WAL mode plus append-only semantics on `audit_events` eliminate write conflicts. The single UPDATE path on `payments` is keyed by nonce (unique), so Producer and Consumer never fight over the same row.

**Loop state machine:** See Section 3.1 for authoritative state definitions, transition table, retry behavior, and timeouts. Section 3.1 is the single source of truth. The orchestrator package exports the state machine as a library consumed by both Producer and Consumer processes — each process owns transitions for its respective role (Consumer owns DECIDING/SIGNING/REPLAYING/VERIFYING; Producer owns VERIFYING-side settle and COMPLETED signal).

### Component 4: Dashboard (Next.js 14)

Pages are ranked **MUST / SHOULD / COULD** to enforce scope discipline. Build in order; cut from the bottom if timeline pressures rise.

**MUST (core demo surface, build first):**
1. `/` — Live loop view: current cycle number, velocity gauge, dual-account balance chart, current state, Aria persona header
2. `/tx` — Transaction log with X Layer explorer links (oklink.com/xlayer/tx/*)

**SHOULD (polish, build if time permits):**
3. `/reasoning` — LLM decision trace (model, prompt excerpt, response, latency, reason text)

**COULD (nice-to-have, last priority):**
4. `/services` — Producer service catalog with demand + revenue per service
5. `/mcp` — MCP call trace (tool invocations, response times)
6. `/analytics` — Cumulative stats, net P/L, top services

**Cut policy:** If by hour 45 of build SHOULD pages are incomplete, abandon COULD pages entirely. If MUST pages are incomplete by hour 50, escalate to halt coding and focus on demo narrative.

**Real-time updates:**
Server-sent events (SSE) from SQLite poll. Next.js API route at `/api/events` polls `audit_events` table every 500ms on `/` page, 2s on `/tx`, on-demand refresh on SHOULD pages.

### Component 5: Shared Package

TypeScript types + constants across apps:

```typescript
// packages/shared/src/types/x402.ts
export interface Accept {
  scheme: 'exact' | 'aggr_deferred';
  network: 'eip155:196';
  amount: string;           // minimal units
  asset: string;            // token contract
  payTo: string;            // recipient address
  maxTimeoutSeconds: number;
  extra: { name: string; version: string };
}

export interface PaymentPayload {
  x402Version: 2;
  resource: { url: string; description: string; mimeType: string };
  accepted: Accept;
  payload: {
    signature: string;
    authorization: {
      from: string;
      to: string;
      value: string;
      validAfter: string;
      validBefore: string;
      nonce: string;
    };
  };
}

// packages/shared/src/types/mcp.ts
export interface QuoteParams {
  chainIndex: '196';
  fromTokenAddress: string;
  toTokenAddress: string;
  amount: string;           // minimal units
  slippage?: string;        // e.g. '0.005'
}

export interface Quote {
  chainIndex: string;
  fromToken: { address: string; symbol: string; decimal: string };
  toToken: { address: string; symbol: string; decimal: string };
  fromTokenAmount: string;
  toTokenAmount: string;
  priceImpactPercentage: string;
  estimateGasFee: string;
  dexRouterList: Array<{ dexName: string; ratio: string }>;
}

export interface TokenPriceInfoParams {
  chainIndex: '196';
  tokenContractAddress: string;
}

export interface TokenPriceInfo {
  chainIndex: string;
  tokenAddress: string;
  symbol: string;
  price: string;
  priceChange24h: string;
  volume24h: string;
  marketCap: string;
  holderCount: string;
}

// packages/shared/src/types/facilitator.ts
export interface VerifyRequest {
  x402Version: 2;
  paymentPayload: PaymentPayload;
  paymentRequirements: Accept;
}

export interface VerifyResponse {
  isValid: boolean;
  invalidReason: string | null;
  invalidMessage: string | null;
  payer: string;
}

export interface SettleRequest extends VerifyRequest {
  syncSettle: boolean;
}

export interface SettleResponse {
  success: boolean;
  errorReason: string | null;
  errorMessage: string | null;
  payer: string;
  transaction: string;
  network: 'eip155:196';
  status: 'pending' | 'success' | 'timeout' | '';
}

// packages/shared/src/constants.ts
export const X_LAYER_CHAIN_ID = 196;
export const X_LAYER_RPC = 'https://rpc.xlayer.tech';
export const X_LAYER_EXPLORER = 'https://www.oklink.com/xlayer';
export const USDG_CONTRACT = '0x4ae46a509f6b1d9056937ba4500cb143933d2dc8';
export const USDT_CONTRACT = '0x779ded0c9e1022225f8e0630b35a9b54be713736';
export const OKX_MCP_ENDPOINT = 'https://web3.okx.com/api/v1/onchainos-mcp';
export const OKX_FACILITATOR_BASE = 'https://web3.okx.com';
export const FACILITATOR_PATHS = {
  supported: '/api/v6/pay/x402/supported',
  verify: '/api/v6/pay/x402/verify',
  settle: '/api/v6/pay/x402/settle',
} as const;
```

Types are fed by MCP schema verification and adjusted after day-one spike (see Section 4.7 risks).

### Component 6: MCP Client Package

JSON-RPC 2.0 client for OKX MCP Server.

```typescript
// packages/mcp-client/src/client.ts
export class OKXMCPClient {
  constructor(private readonly config: { url: string; apiKey: string }) {}
  
  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const response = await fetch(this.config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'OK-ACCESS-KEY': this.config.apiKey,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name, arguments: args },
        id: randomId(),
      }),
    });
    
    const result = await response.json();
    if (result.error) throw new MCPError(result.error);
    return result.result;
  }
  
  getQuote(params: QuoteParams): Promise<Quote> {
    return this.callTool('dex-okx-dex-quote', params);
  }
  
  getTokenPriceInfo(params: TokenPriceInfoParams): Promise<TokenPriceInfo> {
    return this.callTool('dex-okx-market-token-price-info', params);
  }
}
```

### Component 7: OKX Auth Package

HMAC signing utility for Facilitator REST API calls (standard OKX auth pattern).

```typescript
// packages/okx-auth/src/sign.ts
import crypto from 'node:crypto';

export function signRequest(opts: {
  method: 'GET' | 'POST';
  path: string;
  body?: string;
  secretKey: string;
}): { timestamp: string; signature: string } {
  const timestamp = new Date().toISOString();
  const preHash = `${timestamp}${opts.method}${opts.path}${opts.body ?? ''}`;
  const signature = crypto
    .createHmac('sha256', opts.secretKey)
    .update(preHash)
    .digest('base64');
  return { timestamp, signature };
}
```

### Component 8: Onchain Clients Package

Thin wrappers for OKX CLI skills via `child_process.spawn`:
- `agentic-wallet.ts` — status, add, switch, balance, history, send
- `x402-payment.ts` — x402-pay, eip3009-sign
- `trenches.ts` — memepump tokens, token-details, token-dev-info, aped-wallet

Each wrapper: spawn CLI → collect stdout → parse JSON → return typed result.

---

## Section 3: Data Flow + State Machine

### 3.1 Loop State Machine

Loop controller lives in `packages/orchestrator` as a state machine. All transitions logged to SQLite for audit replay.

**States:**
- `IDLE` — waiting for next cycle trigger
- `DECIDING` — LLM is reasoning about next action
- `SIGNING` — awaiting TEE signature from okx-x402-payment CLI
- `REPLAYING` — HTTP replay with PAYMENT-SIGNATURE header
- `VERIFYING` — Producer-side Facilitator /verify call
- `SETTLING` — Producer-side Facilitator /settle call
- `COMPLETED` — cycle done, metrics written
- `FAILED` — retriable error occurred
- `HALTED` — max retries exceeded, manual intervention needed

**Transition table:**

| State | Trigger | Next | Notes |
|---|---|---|---|
| IDLE | LOOP_START | DECIDING | Cycle counter increments, cycle_retry_count = 0 |
| DECIDING | LLM response received | SIGNING | Writes to `decisions` table |
| DECIDING | LLM timeout/429 | FAILED | Backoff + retry |
| SIGNING | CLI returns payment proof | REPLAYING | Writes pending row to `payments` (Consumer) |
| SIGNING | CLI exit code 2 (confirming) | SIGNING with `--force` | Pre-confirmed at setup (verify day 1, see §4.7) |
| SIGNING | CLI error/timeout | FAILED | Log error |
| REPLAYING | HTTP 200 from Producer | VERIFYING | Resource received |
| REPLAYING | HTTP 402 retry | DECIDING (if cycle_retry_count < 3) OR FAILED | Increment cycle_retry_count; escalate on 3rd |
| REPLAYING | HTTP 500 | FAILED | Producer error |
| VERIFYING | Facilitator `isValid: true` | SETTLING | Producer-side (onResponse hook) |
| VERIFYING | `isValid: false` | FAILED | Bad signature |
| SETTLING | Facilitator `success: true` | COMPLETED | tx hash written to `payments` by Producer |
| SETTLING | timeout/5xx | FAILED | Background retry via `wallet history` reconciliation |
| COMPLETED | Event emitted | IDLE | Cycle metrics saved |
| FAILED | Retry count < 1 | Previous state | Exponential backoff |
| FAILED | Retry exceeded | HALTED | Notify dashboard |
| HALTED | User resume | IDLE | Clear retry counter |

**Retry counters (two levels):**
- `state_retry_count` — per-state retry limit (1, exponential backoff). Resets on state exit.
- `cycle_retry_count` — per-cycle retry limit across REPLAYING→DECIDING flips (max 3). Prevents infinite verify-fail loops where LLM keeps re-picking the same broken service.

**Cycle metrics (`loop_cycles` table):**

- `cycle_number`, `started_at`, `completed_at`
- `decision_action`, `decision_reason`, `decision_model`
- `payment_tx_hash`, `payment_amount_usdg`
- `service_called`, `producer_earnings_usdg`
- `consumer_balance_before`, `consumer_balance_after`
- `cycle_duration_ms`, `state_transitions` (JSON)

### 3.2 End-to-End Data Flow (One Cycle)

**Stage 0: Initialization (once per app start)**

1. Dashboard boot → fetch status from orchestrator
2. Orchestrator boot → load .env, verify OKX_API_KEY present
3. Orchestrator → `onchainos wallet status` → verify `loggedIn: true`, `accountCount >= 2`
4. Orchestrator → fetch producer + consumer account IDs from env
5. Orchestrator → `wallet switch <producer_id>` → get producer address
6. Orchestrator → `wallet switch <consumer_id>` → get consumer address + balance
7. Producer boot → register x402-gate Fastify plugin on 3 routes (preHandler + onResponse hooks)
8. Consumer boot → initialize LLM client + reasoner templates
9. Dashboard subscribes to orchestrator SSE stream

**Stage 1: Decision (Consumer Agent, DECIDING state)**

1. `wallet switch <consumer_id>`
2. `wallet balance --chain 196 --token-address <USDG>` → `balance_before`
3. Fetch last 5 cycles from state store → recent earnings + spends
4. Build LLM prompt (system + user JSON state)
5. Call Groq API (llama-3.3-70b-versatile, `response_format: { type: 'json_object' }`)
6. Handle 429 with exponential backoff, max 2 retries
7. Validate JSON with Zod schema
8. Emit `DECISION_MADE`, transition DECIDING → SIGNING

**Decision JSON schema:**
```typescript
const DecisionSchema = z.object({
  action: z.enum(['consume_service', 'wait', 'halt']),
  service: z.enum(['market-snapshot', 'trench-scan', 'swap-quote']).optional(),
  reason: z.string().min(10).max(500),
  expected_benefit: z.string().min(5).max(200),
});
```

**Stage 2: Sign Payment (Consumer Agent, SIGNING state)**

1. HTTP POST to Producer endpoint without payment header → receives 402
2. Decode base64 `PAYMENT-REQUIRED` header → parse JSON
3. Extract `accepts` array
4. Spawn `onchainos payment x402-pay --accepts '<JSON>'` → `{signature, authorization}`
5. Build PaymentPayload v2: `{x402Version: 2, resource, accepted: accepts[0], payload}`
6. Base64 encode, transition SIGNING → REPLAYING

**Stage 3: Replay with Payment**

Consumer:
1. HTTP POST to Producer endpoint with `PAYMENT-SIGNATURE` header

Producer (x402-gate Fastify plugin):
1. `preHandler` hook — extract and decode `PAYMENT-SIGNATURE`
2. `preHandler` — call Facilitator `POST /api/v6/pay/x402/verify` (HMAC signed)
3. If `isValid`, handler executes service logic (MCP call or CLI)
4. Handler returns resource as JSON, HTTP 200
5. `onResponse` hook (fires after response flushed) — async settlement: `POST /api/v6/pay/x402/settle` with `syncSettle: true`
6. `onResponse` emits `SETTLEMENT_COMPLETED` with txHash, updates `payments` row via UPDATE WHERE nonce=?

Consumer (on HTTP 200):
1. Parse response body, emit `SERVICE_CONSUMED`
2. Transition REPLAYING → VERIFYING

**Stage 4: Verify + Complete**

Consumer (post-VERIFYING wait):
1. Producer owns VERIFYING + SETTLING transitions (preHandler + onResponse hooks)
2. Consumer polls SQLite `payments` table for settlement status on current nonce (max 30s)
3. On `payments.status = settled` with non-empty `tx_hash`: cycle → COMPLETED
4. On timeout: fallback to `wallet history` lookup via orchestrator reconciliation, confirm tx, then COMPLETED or FAILED

Orchestrator:
1. Compute cycle metrics
2. Save to `loop_cycles` table
3. Emit `LOOP_CYCLE_COMPLETED`
4. Transition COMPLETED → IDLE

Dashboard:
1. Receives SSE update → re-render live balance + cycle count + velocity gauge

### 3.3 Inter-Process Communication

Three Node processes share a SQLite database as event bus:

```
producer              consumer              dashboard
   │                     │                     │
   └─ writes events to ──┴─ writes events to ──┘
                          ▼
              ┌─────────────────────────────┐
              │  SQLite (WAL mode)          │
              │  data/app.db                │
              └───────────┬─────────────────┘
                          │ polled every 500ms
                          ▼
                  Dashboard SSE /api/events
                          │
                          ▼
                  Browser EventSource
```

**Why SQLite over Redis/socket:**
- Zero infra (2-3 hours saved)
- Durability across restarts
- Query-able for analytics
- `better-sqlite3` synchronous API = simpler code
- WAL mode supports concurrent readers + single writer

**Write ownership:**
- Producer writes: `payments`, `mcp_calls`, settlements
- Consumer writes: `decisions`, `loop_cycles` (header), cycle state
- Dashboard reads only
- No write conflicts (different tables)

**SSE endpoint example:**
```typescript
// apps/dashboard/app/api/events/route.ts
export async function GET(req: Request) {
  const stream = new ReadableStream({
    start(controller) {
      let lastEventId = 0;
      const interval = setInterval(() => {
        const events = db.prepare(
          'SELECT * FROM audit_events WHERE id > ? ORDER BY id LIMIT 100'
        ).all(lastEventId);
        for (const event of events) {
          controller.enqueue(`data: ${JSON.stringify(event)}\n\n`);
          lastEventId = event.id;
        }
      }, 500);
      req.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
```

**Poll intervals:**
- Dashboard Home page (live loop): 500ms
- Analytics page (historical): 2s
- Transactions page: on-demand refresh

### 3.4 Bootstrap Sequence

`scripts/demo-runner.ts` orchestrates:

1. **Pre-flight check:** .env loaded, `onchainos --version` OK, X Layer RPC reachable, Groq API key valid, OKX MCP Server reachable
2. **Wallet setup (idempotent):** `wallet status` → login if needed → `wallet add` if account count < 2 → persist account IDs
3. **Fund Consumer wallet (manual):** user funds Consumer account with USDG from OKX CEX withdrawal, minimum 5 USDG
4. **Verify funding:** `wallet switch <consumer_id>` → `wallet balance` → assert ≥ 1 USDG
5. **Start Producer:** `pnpm --filter producer dev` (Fastify on port 3001), health check GET /health
6. **Start Consumer:** `pnpm --filter consumer start` (Node script runs loop)
7. **Start Dashboard:** `pnpm --filter dashboard dev` (Next.js on port 3000)
8. **Trigger first cycle:** auto-start on Consumer boot OR manual "Start Loop" button
9. **Monitor:** dashboard shows live cycles, target 100+ cycles in 30 min demo

### 3.5 Rate Limit Adaptive Throttling (Groq)

**Tier strategy:**
- **Tier 1 default:** `llama-3.3-70b-versatile` (30 RPM, 1K RPD, 12K TPM)
- **Tier 2 on 429:** `llama-3.1-8b-instant` (30 RPM, 14.4K RPD, 6K TPM) — 14× more daily headroom
- **Upgrade back:** after 60s clean running on 8B, try 70B again
- **Hard halt:** only if 8B also 429 (very unlikely for demo volume)

**Pre-call check:**
- If >25 requests in last 60s → delay next call
- Parse `x-ratelimit-remaining-requests` header → display in dashboard

**Live model badge in dashboard:** Current tier + remaining budget, framed as feature ("agent adapts to constraints") not workaround.

**Loop velocity auto-adjust:**
- Target: 15 cycles/min (1 cycle per 4s)
- If approaching RPM limit: insert delays
- If Groq slow (>2s per call): switch to fast model
- Live velocity gauge in dashboard

---

## Section 4: Error Handling + Testing

### 4.1 Error Taxonomy

**Category A: Retriable Transient (auto retry)**

| Error | Source | Retry Strategy |
|---|---|---|
| Groq 429 rate limit | LLM call | Parse `retry-after`, wait, retry max 2× → downgrade model |
| X Layer RPC 503/timeout | eth_getBalance, eth_sendRawTransaction | Exponential backoff 1s→3s→9s, max 3 retries |
| OKX MCP Server timeout | MCP tool call | Retry 1× with 2s delay → fallback to CLI equivalent |
| Facilitator `/verify` 5xx | Producer verify | Retry 1× with 1s delay → FAILED |
| Facilitator `/settle` timeout | Producer settle | Query tx via `wallet history`, confirm or retry |
| HTTP replay 502/503 | Consumer → Producer | Retry 1× with 500ms delay → FAILED |
| Groq JSON parse error | LLM response | Retry with stricter prompt, max 1 retry |

**Category B: Retriable Semantic (retry with different params)**

| Error | Source | Strategy |
|---|---|---|
| Consumer balance insufficient | Pre-decision check | LLM switches to `wait` action |
| x402 signature expired | Facilitator verify | Re-sign with fresh nonce, retry |
| Confirming response (exit code 2) | CLI returns `confirming: true` | Pre-confirm at setup, retry with `--force` |

**Category C: Fatal (HALT)**

| Error | Source | Action |
|---|---|---|
| Invalid API key | OKX auth | HALT, dashboard shows error card |
| Invalid HMAC signature | Facilitator 401 | HALT, code bug |
| Consumer balance zero | Pre-decision | HALT, dashboard shows "Fund wallet" CTA |
| Producer service crash | Fastify process | HALT, manual restart |
| SQLite database locked | Concurrent write conflict | HALT + alert (should not happen with WAL) |
| Groq API key invalid | LLM call 401 | HALT, dashboard error |

**Category D: Ignorable (log only)**

| Error | Source | Action |
|---|---|---|
| Dashboard SSE disconnect | Browser closes tab | Log, no action |
| Cached MCP call refresh | Stale data | Log, refresh on next call |

### 4.2 Failure Recovery Per Component

**Producer — Facilitator /verify 5xx:**
```typescript
async function verifyWithRetry(payload, opts): Promise<VerifyResult> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await facilitator.verify(payload, opts);
    } catch (e) {
      if (e.status >= 500 && attempt < 2) {
        await sleep(1000 * attempt);
        continue;
      }
      throw new FacilitatorError('verify', e);
    }
  }
}
```

**Producer — Async settlement failure:**
- Log to `payments` table with status `settle_failed`
- Do NOT affect HTTP response (resource already delivered)
- Background retry task every 10s picks up failed settlements
- After 3 background retries → `settle_abandoned`, alert dashboard

**Consumer — x402-payment CLI spawn failure:**
```typescript
async function signPayment(accepts): Promise<PaymentProof> {
  const result = await spawnCli(['payment', 'x402-pay', '--accepts', JSON.stringify(accepts)]);
  if (result.code === 2 && result.stdout.includes('confirming')) {
    return spawnCli(['payment', 'x402-pay', '--accepts', JSON.stringify(accepts), '--force']);
  }
  if (result.code !== 0) {
    throw new CliError('x402-pay', result.stderr);
  }
  return parsePaymentProof(result.stdout);
}
```

**Consumer — HTTP 402 after signing (unexpected):**
- Do NOT retry blindly (same signature will fail)
- Return to DECIDING state
- LLM may choose different service or wait

**Orchestrator — Process crash mid-cycle (with wallet-history reconciliation):**

On boot, BEFORE marking non-terminal cycles as FAILED, reconcile against on-chain reality:

1. Query SQLite for all `payments` rows with status in (`signed`, `verified`) since last COMPLETED cycle
2. For each pending payment, extract nonce from authorization
3. Call `onchainos wallet history --chain xlayer --account-id <producer_id>` to fetch recent Producer receive events
4. Match tx receipts by nonce (in calldata) or by amount + from_addr + timestamp window
5. If tx found on-chain: update payment row with `tx_hash`, `settled_at`, status = `settled`, cycle → COMPLETED retroactively
6. If tx NOT found and time-since-signed > 60s: status = `settle_abandoned`, cycle → FAILED
7. Only after reconciliation pass, resume loop from last COMPLETED cycle

This prevents orphaned paid cycles where on-chain settlement succeeded but local metrics weren't written before crash.

### 4.3 Testing Strategy

**Unit Tests (Vitest), `tests/unit/`:**

| File | Coverage |
|---|---|
| `reasoner.test.ts` | LLM prompt building, response validation, Zod schema |
| `budget.test.ts` | Budget tracking, policy enforcement |
| `okx-auth.test.ts` | HMAC signing with known test vectors |
| `mcp-client.test.ts` | JSON-RPC request/response, error handling |
| `state-machine.test.ts` | All transitions, retry logic, halt conditions |
| `x402-gate.test.ts` | 402 response building, payment payload parsing |
| `sqlite-store.test.ts` | CRUD, concurrent read + write |

Target: 80% line coverage on core packages.

**Integration Tests (Real X Layer Mainnet), `tests/integration/`:**

| File | Scenario |
|---|---|
| `wallet-setup.test.ts` | Login, add, switch, balance query |
| `facilitator-flow.test.ts` | /supported → /verify → /settle with real USDG |
| `x402-end-to-end.test.ts` | Consumer signs → Producer verifies → settles |
| `loop-cycle.test.ts` | One complete cycle from DECIDING to COMPLETED |
| `mcp-tools.test.ts` | Each MCP tool we use, assert response schema |
| `groq-llm.test.ts` | Groq calls with test prompts, validate JSON |

Each run consumes ~0.01-0.05 USDG. Use separate test wallet (2-5 USDG), not demo wallet.

**Integration tests are OPT-IN**, not part of default `pnpm test`:

```bash
# Default (fast, free): unit tests only
pnpm test

# Opt-in (slow, costs USDG): runs integration tests against mainnet
RUN_INTEGRATION=1 pnpm test
```

Rationale: developer iteration (Claude Code Opus 4.6 rewriting code) will run `pnpm test` many times. Hitting mainnet every time would drain the test wallet within a day. Integration tests are run manually before major checkpoints, not on every save.

**Demo Scenarios, `tests/demo/`:**

**Scenario 1: Happy Path Loop** — 30 min, target ≥100 cycles, 0 HALTED, live dashboard updates.

**Scenario 2: Groq 429 Recovery** — artificially throttle after 3 calls, assert auto-downgrade, loop continues.

**Scenario 3: Facilitator Degraded** — mock /verify 503 for 5s, assert retry + recovery.

**Scenario 4: Consumer Out of USDG** — start with 0.1 USDG, assert `wait` action + dashboard warning.

### 4.4 Pre-flight Validation Script

`scripts/health-check.ts` must pass before `scripts/demo-runner.ts`:

```
✓ .env file loaded
✓ OKX_API_KEY, OKX_SECRET_KEY, OKX_PASSPHRASE present
✓ GROQ_API_KEY valid (ping /v1/models)
✓ onchainos CLI installed, --version >= 2.2.8
✓ X Layer RPC reachable (eth_blockNumber returns recent block)
✓ OKX MCP Server reachable (tools/list call)
✓ Facilitator base URL reachable (GET /api/v6/pay/x402/supported signed with HMAC)
✓ Clock drift within 30s of OKX server time (check via HTTP Date header on facilitator /supported)
✓ Wallet logged in (wallet status)
✓ accountCount >= 2
✓ Producer + Consumer addresses present
✓ Consumer USDG balance >= 1 USDG
✓ SQLite writable (INSERT then DELETE test row in audit_events)
✓ Ports 3000, 3001 free
✓ x402-payment CLI signing works (dry-run with test accepts payload)
```

Exit code 0 all pass, non-zero with specific failure message. Fails fast.

**Clock drift check rationale:** OKX HMAC validation rejects requests with timestamp skew >30s. If the local machine clock drifts (container, dev env), all Facilitator calls 401 and demo fails. Check once on health-check by computing `abs(localTime - facilitatorServerTime) < 30s` via HTTP Date header on an unauthenticated endpoint.

### 4.5 Observability

**Structured logging (pino):**
```typescript
logger.info({ 
  cycle: 42, 
  service: 'market-snapshot', 
  duration_ms: 1250,
  decision_reason: 'price recon before trade'
}, 'cycle completed');
```

Log levels:
- `error` — FAILED/HALTED, fatal errors
- `warn` — retries, rate limits, degraded mode
- `info` — cycle transitions, key events
- `debug` — LLM prompts, MCP calls (disabled in demo)

Aggregation: `logs/app.jsonl`, rotated daily.

**Dashboard metrics panel:**
- Cycles completed (total, rate/min)
- Current state (IDLE, DECIDING, etc.)
- Consumer balance + Producer earnings (USDG, live)
- Average cycle duration (ms)
- LLM model tier (70B / 8B downgraded)
- LLM requests remaining (Groq daily)
- Facilitator latency (p50, p99)
- MCP call count per tool
- Failure count (FAILED + HALTED)

**X Layer explorer integration:**
All tx hashes clickable → `https://www.oklink.com/xlayer/tx/<txHash>`

**Audit trail:**
`audit_events` table with all state transitions + events. Exportable JSON for post-demo analysis.

### 4.6 Security Considerations

**Secret handling:**
- `OKX_API_KEY`, `OKX_SECRET_KEY`, `OKX_PASSPHRASE`, `GROQ_API_KEY` loaded only from `.env`
- `.env` in `.gitignore` (configured)
- Pino redact config strips auth fields from logs
- Dashboard never receives secrets (API routes proxy backend)

**HMAC signing validation (common mistakes to avoid):**
- Body with trailing newline breaks signature
- METHOD must be UPPERCASE
- Timestamp ISO 8601 with milliseconds + "Z"
- requestPath includes query string, NOT hostname
- POST body = raw JSON string
- Unit test with known vectors from OKX docs

**x402 payment validation (Producer side):**
- Never trust payload without Facilitator `/verify`
- `/verify` is ONLY source of truth
- Never bypass verify locally

**Input validation (Zod schemas):**
- LLM responses (DecisionSchema)
- MCP tool responses (per-tool schemas)
- x402 payment payloads (X402PayloadSchema)
- Producer service parameters
- Facilitator responses

**Producer endpoint rate limiting:**
- Fastify built-in limiter (100 req/min per IP)
- 402 middleware blocks free-loaders
- Zod rejects malformed payloads early

### 4.7 Known Risks + Mitigations

| Risk | Impact | Probability | Mitigation |
|---|---|---|---|
| Groq outage demo day | Loop halts mid-recording | Low | Record demo before deadline, have backup recording |
| X Layer congestion | Settlement delays | Low | Block time stable 1s, dashboard adapts velocity |
| Facilitator rate limits (undocumented) | Verify/settle rejected | Unknown | **Day 1 spike:** run 100 /verify calls in 60s against sandbox, measure 429 threshold; document in README |
| `x402-pay` CLI `--force` flag behavior | Mid-demo signing stalls if confirming prompt | Medium | **Day 1 spike:** verify `--force` skips prompts, verify pre-confirm session stickiness across calls; if not sticky, auto re-confirm in state machine |
| okx-x402-payment session expiry | Mid-demo signing failures | Medium | Re-auth every 30 min, auto re-login on error |
| Demo video contrived feeling | Judges don't feel economy loop | Medium | Aria persona narrative, before/after screenshots, live dashboard, clickable tx hashes |
| MCP tool schema changes | Producer services break | Low | Zod validation catches early, fallback to default response |
| Scope creep beyond 60 hours | MVP incomplete | Medium | Stick to 3 services, rank dashboard features MUST/SHOULD/COULD, daily checkpoint |
| Fastify hook shape mismatch | Producer integration fails day 1 | Low after fix | Explicit hook-based x402 plugin (Section 2), no Express-style middleware |

**Day 1 mandatory spikes (must happen in first 8 hours of build):**

1. **CLI spike** — spawn `onchainos payment x402-pay --accepts '<minimal test payload>'` and observe behavior. Verify:
   - Does `--force` flag exist in installed CLI version?
   - Does it bypass the confirming prompt?
   - Does session persist across back-to-back calls within same process?
2. **Facilitator throughput spike** — hit `/supported` + `/verify` + `/settle` in tight loop, measure:
   - Rate limit threshold (first 429)
   - Latency distribution (p50, p99)
   - Error recovery behavior
3. **MCP response schema spike** — call `dex-okx-dex-quote` and `dex-okx-market-token-price-info` with real X Layer token, capture response, write Zod schemas that match.

These 3 spikes produce concrete findings that anchor the rest of the build. If any spike reveals blockers, revisit design before continuing.

---

## Summary of Design Doc

| Section | Content |
|---|---|
| 1. Architecture Overview | Two-agent topology, tech stack, verified architecture foundations |
| 2. Component Specification | Monorepo structure, 8 components (Producer, Consumer, Orchestrator, Dashboard, Shared, MCP Client, OKX Auth, Onchain Clients) |
| 3. Data Flow + State Machine | 9-state machine, end-to-end cycle flow, IPC via SQLite, bootstrap sequence, rate limit adaptive throttling |
| 4. Error Handling + Testing | Error taxonomy (4 categories), recovery per component, unit + integration + demo tests, pre-flight validation, observability, security, known risks |

**Honest score midpoint:** 87-92/100
**Prize target:** Main 2nd-3rd tier + Best x402 Application + Best Economy Loop + Best MCP Integration + Most Active Agent (stackable)
**Effort:** 4/5, 60-80 hours realistic
**Status:** Design approved, ready for spec review + implementation plan
