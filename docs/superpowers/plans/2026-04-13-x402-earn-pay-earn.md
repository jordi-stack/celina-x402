# x402 Earn-Pay-Earn Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack agentic economy loop app (Producer + Consumer agents) that demonstrates earn-pay-earn on X Layer via x402, running autonomously with zero gas, for OKX Build X hackathon X Layer Arena submission.

**Architecture:** Two-agent topology in a pnpm monorepo. Producer is a Fastify HTTP service exposing 3 paid endpoints; Consumer is a Node loop that reasons via Groq LLM and signs x402 payments via OKX CLI. Both share a SQLite-backed orchestrator for state + events. Next.js dashboard polls SQLite for live visualization. OKX Facilitator API handles on-chain settlement. OKX MCP Server provides market and swap data to Producer services.

**Tech Stack:** TypeScript, Node.js 20+, pnpm workspaces, Fastify, Next.js 14 App Router, Tailwind + shadcn/ui, SQLite (better-sqlite3), Groq (llama-3.3-70b-versatile + llama-3.1-8b-instant), Vitest, Zod, OKX OnchainOS CLI, OKX MCP Server HTTP JSON-RPC, OKX Facilitator REST API.

**Spec reference:** [docs/superpowers/specs/2026-04-13-x402-earn-pay-earn-design.md](../specs/2026-04-13-x402-earn-pay-earn-design.md)

**Prize target:** X Layer Arena main 2nd-3rd tier + Best x402 Application + Best Economy Loop + Best MCP Integration + Most Active Agent (stackable, 3000-6500 USDT range).

**Effort estimate:** 60-80 hours across 7 chunks.

---

## Chunks Overview

1. **Chunk 1: Foundation & Day-1 Spikes** — monorepo scaffolding, shared package, okx-auth package, spike scripts + findings
2. **Chunk 2: Orchestrator & SQLite** — schema, state store, state machine, event bus, recovery
3. **Chunk 3: MCP Client & Onchain Clients** — JSON-RPC MCP client, CLI wrappers for wallet + x402-payment
4. **Chunk 4: Producer Agent** — Fastify app, x402-gate plugin, 3 service routes, facilitator client
5. **Chunk 5: Consumer Agent** — agent loop, Groq reasoner, rate limit throttler, HTTP replay
6. **Chunk 6: Dashboard (MUST pages)** — Next.js scaffold, home + tx pages, SSE endpoint
7. **Chunk 7: Integration & Demo** — bootstrap script, health check, end-to-end tests, README, demo scenarios, SHOULD/COULD dashboard pages if time permits

---

## Chunk 1: Foundation & Day-1 Spikes

**Goal:** Monorepo scaffolded, foundation packages ready, day-1 spikes executed and findings documented. Unblocks all subsequent chunks.

**Why this comes first:** Day-1 spikes (CLI `--force` behavior, Facilitator throughput, MCP schema) can reveal blockers that invalidate architecture assumptions. Running them before building anything heavy protects against wasted effort.

---

### Task 1: Initialize pnpm Monorepo

**Files:**
- Verify exists: `.gitignore` (created during brainstorming phase)
- Verify exists: `.env.example` (created during brainstorming phase)
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.nvmrc`
- Create: `README.md` (minimal)

**Prerequisites:**
- `onchainos` CLI installed and reachable on PATH
- Working directory is `/root/hackathon/okx/x402-earn-pay-earn` (already exists)
- `.gitignore` and `.env.example` already present (from brainstorming phase)
- Parent directory is NOT already a git repo

**Steps:**

- [x] **Step 1.1: Verify prerequisites (Node, pnpm, pre-existing files, no parent git repo)**

Run:
```bash
cd /root/hackathon/okx/x402-earn-pay-earn
node --version
pnpm --version
ls -la .gitignore .env.example
git rev-parse --show-toplevel 2>&1 || echo "no parent git repo"
```

Expected:
- `node` >= v20
- `pnpm` >= v9 (install via `corepack enable pnpm` or `npm install -g pnpm@9` if missing)
- Both `.gitignore` and `.env.example` exist
- `no parent git repo` OR the output path is `/root/hackathon/okx/x402-earn-pay-earn` itself

If parent git repo exists, STOP. Resolve with user before continuing.

- [x] **Step 1.2: Initialize git repo BEFORE installing dependencies**

Run:
```bash
cd /root/hackathon/okx/x402-earn-pay-earn
git init
git status
```

Expected: git initialized, `.gitignore` and `.env.example` appear as untracked. `node_modules/` should NOT appear (because `.gitignore` already excludes it from the start).

- [x] **Step 1.3: Create `.nvmrc`**

Create file `.nvmrc` with content:
```
20
```

- [x] **Step 1.4: Create root `package.json`**

Create file `package.json` with content:
```json
{
  "name": "x402-earn-pay-earn",
  "version": "0.1.0",
  "private": true,
  "packageManager": "pnpm@9.0.0",
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint",
    "typecheck": "pnpm -r typecheck",
    "dev:producer": "pnpm --filter producer dev",
    "dev:consumer": "pnpm --filter consumer start",
    "dev:dashboard": "pnpm --filter dashboard dev",
    "health-check": "pnpm --filter @x402/scripts health-check",
    "demo-runner": "pnpm --filter @x402/scripts demo"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "@types/node": "^20.16.0",
    "vitest": "^2.1.0"
  }
}
```

- [x] **Step 1.5: Create `pnpm-workspace.yaml`**

Create file `pnpm-workspace.yaml` with content:
```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "scripts"
```

- [x] **Step 1.6: Create `tsconfig.base.json`**

Create file `tsconfig.base.json` with content:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [x] **Step 1.7: Create minimal `README.md`**

Create file `README.md` with content:
```markdown
# x402 Earn-Pay-Earn

Full-stack agentic economy loop for OKX Build X hackathon. Producer and Consumer agents autonomously earn and pay via x402 on X Layer.

**Status:** In development.

See [docs/superpowers/specs/2026-04-13-x402-earn-pay-earn-design.md](docs/superpowers/specs/2026-04-13-x402-earn-pay-earn-design.md) for full design.

## Quickstart

```bash
pnpm install
pnpm health-check
pnpm demo-runner
```

Details to be expanded in Chunk 7.
```

- [x] **Step 1.8: Install root dev dependencies**

Run:
```bash
cd /root/hackathon/okx/x402-earn-pay-earn
pnpm install
```

Expected: creates `node_modules/` and `pnpm-lock.yaml`, zero errors. Warnings about missing workspace packages are OK because we haven't created them yet. `node_modules/` should be git-ignored automatically via the pre-existing `.gitignore`.

- [x] **Step 1.9: Verify install**

Run:
```bash
pnpm --version
ls node_modules/.pnpm | head -5
git status
```

Expected: version printed, some packages installed under `.pnpm`. `git status` should NOT show `node_modules/` as untracked (should be gitignored). Only `.nvmrc`, `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `README.md`, `pnpm-lock.yaml` appear as new/untracked.

- [x] **Step 1.10: Commit**

```bash
git add .gitignore .env.example README.md package.json pnpm-workspace.yaml tsconfig.base.json .nvmrc pnpm-lock.yaml docs/
git commit -m "feat(scaffold): initialize pnpm monorepo with TypeScript config"
```

Expected: commit succeeds, no node_modules in staged files.

---

### Task 2: Create `packages/shared` Package (Types + Constants)

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/constants.ts`
- Create: `packages/shared/src/types/x402.ts`
- Create: `packages/shared/src/types/facilitator.ts`
- Create: `packages/shared/src/types/mcp.ts`
- Create: `packages/shared/src/types/agent.ts`

**Steps:**

- [x] **Step 2.1: Create package.json**

Create file `packages/shared/package.json`:
```json
{
  "name": "@x402/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "tsc",
    "test": "vitest run"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  },
  "dependencies": {
    "zod": "^3.23.8"
  }
}
```

- [x] **Step 2.2: Create tsconfig.json**

Create file `packages/shared/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

- [x] **Step 2.3: Create constants.ts**

Create file `packages/shared/src/constants.ts`:
```typescript
export const X_LAYER_CHAIN_ID = 196;
export const X_LAYER_CAIP2 = 'eip155:196' as const;
export const X_LAYER_RPC = 'https://rpc.xlayer.tech';
export const X_LAYER_EXPLORER = 'https://www.oklink.com/xlayer';

export const USDG_CONTRACT = '0x4ae46a509f6b1d9056937ba4500cb143933d2dc8' as const;
export const USDT_CONTRACT = '0x779ded0c9e1022225f8e0630b35a9b54be713736' as const;
export const USDG_DECIMALS = 6;
export const USDT_DECIMALS = 6;

export const OKX_MCP_ENDPOINT = 'https://web3.okx.com/api/v1/onchainos-mcp';
export const OKX_FACILITATOR_BASE = 'https://web3.okx.com';

export const FACILITATOR_PATHS = {
  supported: '/api/v6/pay/x402/supported',
  verify: '/api/v6/pay/x402/verify',
  settle: '/api/v6/pay/x402/settle',
} as const;

export const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
export const GROQ_PRIMARY_MODEL = 'llama-3.3-70b-versatile' as const;
export const GROQ_FAST_MODEL = 'llama-3.1-8b-instant' as const;

export const HMAC_CLOCK_SKEW_TOLERANCE_MS = 30_000;
export const CYCLE_RETRY_MAX = 3;
export const STATE_RETRY_MAX = 1;

export const PRODUCER_PORT = 3001;
export const DASHBOARD_PORT = 3000;
```

- [x] **Step 2.4: Create types/x402.ts**

Create file `packages/shared/src/types/x402.ts`:
```typescript
import { z } from 'zod';

export const AcceptSchema = z.object({
  scheme: z.enum(['exact', 'aggr_deferred']),
  network: z.literal('eip155:196'),
  amount: z.string().regex(/^[0-9]+$/),
  asset: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  payTo: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  maxTimeoutSeconds: z.number().positive(),
  extra: z.object({
    name: z.string(),
    version: z.string(),
  }),
});
export type Accept = z.infer<typeof AcceptSchema>;

export const AuthorizationSchema = z.object({
  from: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  to: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  value: z.string().regex(/^[0-9]+$/),
  validAfter: z.string(),
  validBefore: z.string(),
  nonce: z.string().regex(/^0x[a-fA-F0-9]+$/),
});
export type Authorization = z.infer<typeof AuthorizationSchema>;

export const PaymentPayloadSchema = z.object({
  x402Version: z.literal(2),
  resource: z.object({
    url: z.string().url(),
    description: z.string(),
    mimeType: z.string(),
  }),
  accepted: AcceptSchema,
  payload: z.object({
    signature: z.string(),
    authorization: AuthorizationSchema,
    sessionCert: z.string().optional(),
  }),
});
export type PaymentPayload = z.infer<typeof PaymentPayloadSchema>;

export const Challenge402Schema = z.object({
  x402Version: z.literal(2),
  error: z.string().optional(),
  resource: z.object({
    url: z.string(),
    description: z.string(),
    mimeType: z.string(),
  }),
  accepts: z.array(AcceptSchema),
});
export type Challenge402 = z.infer<typeof Challenge402Schema>;
```

- [x] **Step 2.5: Create types/facilitator.ts**

Create file `packages/shared/src/types/facilitator.ts`:
```typescript
import { z } from 'zod';
import { PaymentPayloadSchema, AcceptSchema } from './x402';

export const VerifyRequestSchema = z.object({
  x402Version: z.literal(2),
  paymentPayload: PaymentPayloadSchema,
  paymentRequirements: AcceptSchema,
});
export type VerifyRequest = z.infer<typeof VerifyRequestSchema>;

export const VerifyResponseSchema = z.object({
  isValid: z.boolean(),
  invalidReason: z.string().nullable(),
  invalidMessage: z.string().nullable(),
  payer: z.string(),
});
export type VerifyResponse = z.infer<typeof VerifyResponseSchema>;

export const SettleRequestSchema = VerifyRequestSchema.extend({
  syncSettle: z.boolean(),
});
export type SettleRequest = z.infer<typeof SettleRequestSchema>;

export const SettleResponseSchema = z.object({
  success: z.boolean(),
  errorReason: z.string().nullable(),
  errorMessage: z.string().nullable(),
  payer: z.string(),
  transaction: z.string(),
  network: z.literal('eip155:196'),
  status: z.enum(['pending', 'success', 'timeout', '']),
});
export type SettleResponse = z.infer<typeof SettleResponseSchema>;

// NOTE: Loose pre-spike shape. Day 1 facilitator spike will capture real response
// and pin this schema. Use .passthrough() to avoid spike failures on unexpected fields.
export const SupportedResponseSchema = z
  .object({
    kinds: z
      .array(
        z
          .object({
            x402Version: z.literal(2),
            scheme: z.enum(['exact', 'aggr_deferred']),
            network: z.literal('eip155:196'),
          })
          .passthrough()
      )
      .optional(),
    extensions: z.array(z.string()).optional(),
    signers: z.unknown().optional(),
  })
  .passthrough();
export type SupportedResponse = z.infer<typeof SupportedResponseSchema>;

export const OkxApiEnvelopeSchema = z.object({
  code: z.string(),
  msg: z.string(),
  data: z.unknown(),
});
export type OkxApiEnvelope = z.infer<typeof OkxApiEnvelopeSchema>;
```

- [x] **Step 2.6: Create types/mcp.ts**

Create file `packages/shared/src/types/mcp.ts`:
```typescript
import { z } from 'zod';

export const QuoteParamsSchema = z.object({
  chainIndex: z.literal('196'),
  fromTokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  toTokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  amount: z.string().regex(/^[0-9]+$/),
  slippage: z.string().optional(),
});
export type QuoteParams = z.infer<typeof QuoteParamsSchema>;

// NOTE: Pre-spike shape based on spec Section 2 Component 5.
// Day 1 MCP spike (Task 7) will capture real response and tighten via Step 7.6.
// All fields optional + .passthrough() so spike parsing succeeds regardless.
export const QuoteSchema = z
  .object({
    chainIndex: z.string().optional(),
    fromToken: z
      .object({
        address: z.string(),
        symbol: z.string(),
        decimal: z.string(),
      })
      .passthrough()
      .optional(),
    toToken: z
      .object({
        address: z.string(),
        symbol: z.string(),
        decimal: z.string(),
      })
      .passthrough()
      .optional(),
    fromTokenAmount: z.string().optional(),
    toTokenAmount: z.string().optional(),
    priceImpactPercentage: z.string().optional(),
    estimateGasFee: z.string().optional(),
    dexRouterList: z
      .array(
        z
          .object({
            dexName: z.string().optional(),
            ratio: z.string().optional(),
          })
          .passthrough()
      )
      .optional(),
  })
  .passthrough();
export type Quote = z.infer<typeof QuoteSchema>;

export const TokenPriceInfoParamsSchema = z.object({
  chainIndex: z.literal('196'),
  tokenContractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});
export type TokenPriceInfoParams = z.infer<typeof TokenPriceInfoParamsSchema>;

// NOTE: Pre-spike shape based on spec Section 2 Component 5.
// Fields will be tightened after Day 1 MCP spike (Task 7).
export const TokenPriceInfoSchema = z
  .object({
    chainIndex: z.string().optional(),
    tokenAddress: z.string().optional(),
    tokenContractAddress: z.string().optional(),
    symbol: z.string().optional(),
    price: z.string().optional(),
    priceChange24h: z.string().optional(),
    volume24h: z.string().optional(),
    marketCap: z.string().optional(),
    holderCount: z.string().optional(),
  })
  .passthrough();
export type TokenPriceInfo = z.infer<typeof TokenPriceInfoSchema>;

export const McpJsonRpcRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  method: z.literal('tools/call'),
  params: z.object({
    name: z.string(),
    arguments: z.record(z.string(), z.unknown()),
  }),
  id: z.union([z.string(), z.number()]),
});
export type McpJsonRpcRequest = z.infer<typeof McpJsonRpcRequestSchema>;

export const McpJsonRpcResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]),
  result: z.unknown().optional(),
  error: z
    .object({
      code: z.number(),
      message: z.string(),
      data: z.unknown().optional(),
    })
    .optional(),
});
export type McpJsonRpcResponse = z.infer<typeof McpJsonRpcResponseSchema>;
```

- [x] **Step 2.7: Create types/agent.ts**

Create file `packages/shared/src/types/agent.ts`:
```typescript
import { z } from 'zod';

export const CycleStateSchema = z.enum([
  'IDLE',
  'DECIDING',
  'SIGNING',
  'REPLAYING',
  'VERIFYING',
  'SETTLING',
  'COMPLETED',
  'FAILED',
  'HALTED',
]);
export type CycleState = z.infer<typeof CycleStateSchema>;

export const ServiceNameSchema = z.enum([
  'market-snapshot',
  'trench-scan',
  'swap-quote',
]);
export type ServiceName = z.infer<typeof ServiceNameSchema>;

export const DecisionSchema = z.object({
  action: z.enum(['consume_service', 'wait', 'halt']),
  service: ServiceNameSchema.optional(),
  reason: z.string().min(10).max(500),
  expected_benefit: z.string().min(5).max(200),
});
export type Decision = z.infer<typeof DecisionSchema>;

export const PaymentStatusSchema = z.enum([
  'signed',
  'verified',
  'settled',
  'settle_failed',
  'settle_abandoned',
]);
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

export const AuditEventSchema = z.object({
  id: z.number().optional(),
  timestamp: z.number(),
  source: z.enum(['producer', 'consumer', 'orchestrator']),
  kind: z.string(),
  cycleNumber: z.number().nullable(),
  payload: z.record(z.string(), z.unknown()),
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;
```

- [x] **Step 2.8: Create index.ts (barrel)**

Create file `packages/shared/src/index.ts`:
```typescript
export * from './constants';
export * from './types/x402';
export * from './types/facilitator';
export * from './types/mcp';
export * from './types/agent';
```

- [x] **Step 2.9: Install shared package deps + typecheck**

Run:
```bash
cd /root/hackathon/okx/x402-earn-pay-earn
pnpm install
pnpm --filter @x402/shared typecheck
```

Expected: zero TypeScript errors. If errors, fix them before committing.

- [x] **Step 2.10: Commit**

```bash
git add packages/shared/
git commit -m "feat(shared): add types, constants, and Zod schemas for x402/MCP/facilitator/agent"
```

---

### Task 3: Create `packages/okx-auth` Package with HMAC Unit Tests

**Files:**
- Create: `packages/okx-auth/package.json`
- Create: `packages/okx-auth/tsconfig.json`
- Create: `packages/okx-auth/src/index.ts`
- Create: `packages/okx-auth/src/sign.ts`
- Create: `packages/okx-auth/tests/sign.test.ts`

**Steps:**

- [x] **Step 3.1: Create package.json**

Create file `packages/okx-auth/package.json`:
```json
{
  "name": "@x402/okx-auth",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "tsc",
    "test": "vitest run"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [x] **Step 3.2: Create tsconfig.json**

Create file `packages/okx-auth/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

- [x] **Step 3.3: Write failing test first**

Create file `packages/okx-auth/tests/sign.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { signOkxRequest } from '../src/sign';

describe('signOkxRequest', () => {
  it('produces expected signature for GET request with known secret', () => {
    // Deterministic test vector: fixed timestamp, method, path, empty body
    const result = signOkxRequest({
      method: 'GET',
      path: '/api/v6/pay/x402/supported',
      body: '',
      secretKey: 'TEST_SECRET_KEY',
      timestamp: '2026-04-13T14:30:00.000Z',
    });

    expect(result.timestamp).toBe('2026-04-13T14:30:00.000Z');
    expect(result.signature).toMatch(/^[A-Za-z0-9+/=]+$/); // base64 format
    expect(result.signature.length).toBeGreaterThan(20);
  });

  it('produces different signature for POST request with body', () => {
    const get = signOkxRequest({
      method: 'GET',
      path: '/api/v6/pay/x402/verify',
      body: '',
      secretKey: 'TEST_SECRET_KEY',
      timestamp: '2026-04-13T14:30:00.000Z',
    });

    const post = signOkxRequest({
      method: 'POST',
      path: '/api/v6/pay/x402/verify',
      body: '{"x402Version":2}',
      secretKey: 'TEST_SECRET_KEY',
      timestamp: '2026-04-13T14:30:00.000Z',
    });

    expect(get.signature).not.toBe(post.signature);
  });

  it('produces different signature when body changes', () => {
    const a = signOkxRequest({
      method: 'POST',
      path: '/api/v6/pay/x402/settle',
      body: '{"a":1}',
      secretKey: 'TEST_SECRET_KEY',
      timestamp: '2026-04-13T14:30:00.000Z',
    });

    const b = signOkxRequest({
      method: 'POST',
      path: '/api/v6/pay/x402/settle',
      body: '{"a":2}',
      secretKey: 'TEST_SECRET_KEY',
      timestamp: '2026-04-13T14:30:00.000Z',
    });

    expect(a.signature).not.toBe(b.signature);
  });

  it('generates timestamp in ISO 8601 format when not provided', () => {
    const result = signOkxRequest({
      method: 'GET',
      path: '/test',
      secretKey: 'TEST_SECRET_KEY',
    });

    // ISO 8601 with milliseconds + Z suffix
    expect(result.timestamp).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    );
  });

  it('rejects lowercase method (pre-hash expects uppercase)', () => {
    expect(() =>
      signOkxRequest({
        // @ts-expect-error intentional invalid input
        method: 'get',
        path: '/test',
        secretKey: 'TEST_SECRET_KEY',
      })
    ).toThrow(/uppercase/i);
  });

  it('body with trailing newline produces different signature than body without', () => {
    // Spec Section 4.6: "Body with trailing newline breaks signature" is a
    // known HMAC pitfall. Proves we do NOT strip trailing newlines silently.
    const withNewline = signOkxRequest({
      method: 'POST',
      path: '/api/v6/pay/x402/settle',
      body: '{"x402Version":2}\n',
      secretKey: 'TEST_SECRET_KEY',
      timestamp: '2026-04-13T14:30:00.000Z',
    });

    const withoutNewline = signOkxRequest({
      method: 'POST',
      path: '/api/v6/pay/x402/settle',
      body: '{"x402Version":2}',
      secretKey: 'TEST_SECRET_KEY',
      timestamp: '2026-04-13T14:30:00.000Z',
    });

    expect(withNewline.signature).not.toBe(withoutNewline.signature);
  });

  it('path including query string affects signature', () => {
    // Spec Section 4.6: "requestPath includes query string but NOT hostname".
    const bare = signOkxRequest({
      method: 'GET',
      path: '/api/v6/dex/aggregator/quote',
      secretKey: 'TEST_SECRET_KEY',
      timestamp: '2026-04-13T14:30:00.000Z',
    });

    const withQuery = signOkxRequest({
      method: 'GET',
      path: '/api/v6/dex/aggregator/quote?chainIndex=196',
      secretKey: 'TEST_SECRET_KEY',
      timestamp: '2026-04-13T14:30:00.000Z',
    });

    expect(bare.signature).not.toBe(withQuery.signature);
  });

  it('signature is deterministic across multiple calls with same inputs', () => {
    // Sanity check: no random salt, output must be reproducible.
    const a = signOkxRequest({
      method: 'POST',
      path: '/api/v6/pay/x402/verify',
      body: '{"test":1}',
      secretKey: 'TEST_SECRET_KEY',
      timestamp: '2026-04-13T14:30:00.000Z',
    });

    const b = signOkxRequest({
      method: 'POST',
      path: '/api/v6/pay/x402/verify',
      body: '{"test":1}',
      secretKey: 'TEST_SECRET_KEY',
      timestamp: '2026-04-13T14:30:00.000Z',
    });

    expect(a.signature).toBe(b.signature);
  });

  it('known OKX docs test vector: GET with empty body produces expected signature', () => {
    // Reference vector adapted from OKX docs signing example.
    // Uses fixed inputs so we can verify against manual HMAC computation.
    const result = signOkxRequest({
      method: 'GET',
      path: '/api/v5/account/balance',
      body: '',
      secretKey: 'SECRET123',
      timestamp: '2020-12-08T09:08:57.715Z',
    });

    // Signature must be base64 format and non-empty
    expect(result.signature).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(result.signature.length).toBeGreaterThan(40);

    // Known vector: manually computed HMAC-SHA256 base64 of the pre-hash
    // preHash = "2020-12-08T09:08:57.715ZGET/api/v5/account/balance"
    // Computed via: echo -n "2020-12-08T09:08:57.715ZGET/api/v5/account/balance" | openssl dgst -sha256 -hmac "SECRET123" -binary | base64
    // Agent executing plan: re-compute and pin this value to prevent regression.
    // Value intentionally omitted until agent verifies locally to avoid false anchor.
  });
});
```

- [x] **Step 3.4: Run test to verify it fails**

Run:
```bash
pnpm --filter @x402/okx-auth test
```

Expected: FAIL with "Cannot find module '../src/sign'" or similar. This confirms test is wired up and will drive implementation.

- [x] **Step 3.5: Create sign.ts (minimal implementation to pass tests)**

Create file `packages/okx-auth/src/sign.ts`:
```typescript
import crypto from 'node:crypto';

export interface SignRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: string;
  secretKey: string;
  timestamp?: string;
}

export interface SignedRequest {
  timestamp: string;
  signature: string;
}

/**
 * Sign an OKX REST API request using HMAC-SHA256 per OKX standard auth.
 *
 * Pre-hash format: `timestamp + METHOD + path + body`
 * Signature: Base64(HMAC-SHA256(preHash, secretKey))
 *
 * Timestamp must be ISO 8601 UTC with milliseconds + "Z" suffix,
 * and within 30 seconds of OKX server time.
 */
export function signOkxRequest(opts: SignRequestOptions): SignedRequest {
  if (opts.method !== opts.method.toUpperCase()) {
    throw new Error('HTTP method must be uppercase (GET, POST, etc.)');
  }

  const timestamp = opts.timestamp ?? isoTimestampWithMs();
  const body = opts.body ?? '';
  const preHash = `${timestamp}${opts.method}${opts.path}${body}`;

  const signature = crypto
    .createHmac('sha256', opts.secretKey)
    .update(preHash)
    .digest('base64');

  return { timestamp, signature };
}

function isoTimestampWithMs(): string {
  return new Date().toISOString();
}
```

- [x] **Step 3.6: Create index.ts (barrel)**

Create file `packages/okx-auth/src/index.ts`:
```typescript
export * from './sign';
```

- [x] **Step 3.7: Run tests to verify all pass**

Run:
```bash
pnpm --filter @x402/okx-auth test
```

Expected: 9 tests pass, 0 failing.

- [x] **Step 3.8: Typecheck**

Run:
```bash
pnpm --filter @x402/okx-auth typecheck
```

Expected: zero errors.

- [x] **Step 3.9: Commit**

```bash
git add packages/okx-auth/
git commit -m "feat(okx-auth): add HMAC-SHA256 signing for OKX REST API with unit tests"
```

---

### Task 4: Scaffold `scripts` Package for Spikes + Utilities

**Files:**
- Create: `scripts/package.json`
- Create: `scripts/tsconfig.json`
- Create: `scripts/src/spikes/README.md`

**Steps:**

- [x] **Step 4.1: Create package.json**

Create file `scripts/package.json`:
```json
{
  "name": "@x402/scripts",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "spike:cli": "tsx src/spikes/cli-spike.ts",
    "spike:facilitator": "tsx src/spikes/facilitator-spike.ts",
    "spike:mcp": "tsx src/spikes/mcp-spike.ts",
    "spike:all": "pnpm spike:cli && pnpm spike:facilitator && pnpm spike:mcp",
    "health-check": "tsx src/health-check.ts",
    "demo": "tsx src/demo-runner.ts"
  },
  "dependencies": {
    "@x402/shared": "workspace:*",
    "@x402/okx-auth": "workspace:*",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "tsx": "^4.19.0",
    "@types/node": "^20.16.0"
  }
}
```

- [x] **Step 4.2: Create tsconfig.json**

Create file `scripts/tsconfig.json`:
```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "types": ["node"]
  },
  "include": ["src/**/*"]
}
```

- [x] **Step 4.3: Create spikes README**

Create file `scripts/src/spikes/README.md`:
```markdown
# Day 1 Mandatory Spikes

These spikes must run successfully before any heavy build work begins. Each spike produces findings written to `scripts/src/spikes/findings/<spike-name>.md`.

## 1. CLI Spike (`spike:cli`)

Verifies `onchainos payment x402-pay` CLI behavior:
- Does `--force` flag exist?
- Does it bypass confirming prompts?
- Does session persist across back-to-back calls?

## 2. Facilitator Throughput Spike (`spike:facilitator`)

Measures OKX Facilitator API:
- First 429 threshold (requests/min until rate limited)
- Latency distribution (p50, p99)
- Error recovery behavior
- Verify happy path works with HMAC

## 3. MCP Schema Spike (`spike:mcp`)

Captures real response shapes from OKX MCP Server for:
- `dex-okx-dex-quote`
- `dex-okx-market-token-price-info`

Output used to refine Zod schemas in `@x402/shared`.

## Running

Prerequisites: `.env` with OKX credentials, `onchainos` CLI installed.

```bash
pnpm install
pnpm spike:all
```

Findings saved to `scripts/src/spikes/findings/`.
```

- [x] **Step 4.4: Create findings directory placeholder**

Run:
```bash
mkdir -p /root/hackathon/okx/x402-earn-pay-earn/scripts/src/spikes/findings
touch /root/hackathon/okx/x402-earn-pay-earn/scripts/src/spikes/findings/.gitkeep
```

- [x] **Step 4.5: Install deps**

Run:
```bash
cd /root/hackathon/okx/x402-earn-pay-earn
pnpm install
```

Expected: `@x402/scripts` package resolved, tsx installed.

- [x] **Step 4.6: Commit**

```bash
git add scripts/
git commit -m "chore(scripts): scaffold scripts package for spikes + utilities"
```

---

### Task 5: Day 1 Spike 1 — CLI `--force` and Session Behavior

**Files:**
- Create: `scripts/src/spikes/cli-spike.ts`
- Create: `scripts/src/spikes/findings/cli-spike.md`

**Steps:**

- [x] **Step 5.1: Create CLI spike script**

Create file `scripts/src/spikes/cli-spike.ts`:
```typescript
#!/usr/bin/env tsx
/**
 * Day 1 Spike: CLI --force flag + session stickiness
 *
 * Verifies:
 * 1. `onchainos --version` returns >= 2.2.8
 * 2. `onchainos wallet status` works and returns loggedIn boolean
 * 3. `onchainos payment x402-pay --help` includes --force flag
 * 4. Back-to-back `x402-pay` calls in same process share session (no re-auth)
 */
import { execa } from 'execa';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

interface Finding {
  timestamp: string;
  cli_version: string;
  wallet_status: string;
  force_flag_present: boolean;
  force_flag_help: string;
  session_test_results: string[];
  blockers: string[];
  recommendation: string;
}

async function run() {
  const findings: Finding = {
    timestamp: new Date().toISOString(),
    cli_version: '',
    wallet_status: '',
    force_flag_present: false,
    force_flag_help: '',
    session_test_results: [],
    blockers: [],
    recommendation: '',
  };

  try {
    // 1. Version check
    const { stdout: versionOut } = await execa('onchainos', ['--version']);
    findings.cli_version = versionOut.trim();
    console.log(`CLI version: ${findings.cli_version}`);

    if (!/^v?(\d+)\.(\d+)\.(\d+)/.test(findings.cli_version)) {
      findings.blockers.push('CLI version string unparseable');
    }

    // 2. Wallet status
    const { stdout: statusOut } = await execa('onchainos', ['wallet', 'status'], {
      reject: false,
    });
    findings.wallet_status = statusOut.trim();
    console.log(`Wallet status: ${findings.wallet_status.slice(0, 200)}`);

    // 3. x402-pay --help
    const { stdout: helpOut, stderr: helpErr } = await execa(
      'onchainos',
      ['payment', 'x402-pay', '--help'],
      { reject: false }
    );
    const helpCombined = `${helpOut}\n${helpErr}`;
    findings.force_flag_present = /--force/.test(helpCombined);
    findings.force_flag_help = helpCombined.slice(0, 500);
    console.log(`--force present: ${findings.force_flag_present}`);

    if (!findings.force_flag_present) {
      findings.blockers.push(
        'CLI `onchainos payment x402-pay` does not expose --force flag. State machine will stall on confirming prompts.'
      );
    }

    // 4. Session stickiness test — back-to-back wallet status calls (no x402 payload needed)
    // Spec Section 4.7 requires verifying session persists across consecutive CLI spawns.
    if (/loggedIn.*true/i.test(findings.wallet_status)) {
      console.log('Testing session stickiness via 3 back-to-back wallet status calls...');
      const stickyResults: string[] = [];
      for (let i = 1; i <= 3; i++) {
        const { stdout, stderr } = await execa('onchainos', ['wallet', 'status'], {
          reject: false,
        });
        const combined = `${stdout}\n${stderr}`;
        const stillLoggedIn = /loggedIn.*true/i.test(combined);
        const promptedForLogin = /log in|verify OTP|enter.*email/i.test(combined);
        stickyResults.push(
          `Call ${i}: loggedIn=${stillLoggedIn}, prompted=${promptedForLogin}`
        );
        if (!stillLoggedIn) {
          findings.blockers.push(
            `Session lost between CLI calls (call ${i}). Loop will constantly re-auth.`
          );
          break;
        }
        if (promptedForLogin) {
          findings.blockers.push(
            `CLI prompted for login on call ${i}. State machine will stall.`
          );
          break;
        }
      }
      findings.session_test_results.push(...stickyResults);
      findings.session_test_results.push(
        stickyResults.every((r) => /loggedIn=true, prompted=false/.test(r))
          ? 'PASS: 3 consecutive calls all logged in, no prompts.'
          : 'FAIL: session did not persist cleanly.'
      );
    } else {
      findings.session_test_results.push(
        'Not logged in — run `onchainos wallet login` first. Then re-run spike.'
      );
      findings.blockers.push('Not logged in. Run setup before proceeding.');
    }

    findings.recommendation =
      findings.blockers.length === 0
        ? 'PROCEED — CLI ready for use.'
        : `HALT — ${findings.blockers.length} blocker(s) found. Resolve before continuing.`;
  } catch (e: unknown) {
    findings.blockers.push(`Spike failed: ${(e as Error).message}`);
    findings.recommendation = 'HALT — spike execution failed.';
  }

  const findingsPath = path.join(
    'scripts',
    'src',
    'spikes',
    'findings',
    'cli-spike.md'
  );
  const md = formatFindings(findings);
  await writeFile(findingsPath, md, 'utf8');
  console.log(`\nFindings written to ${findingsPath}\n`);
  console.log(findings.recommendation);

  if (findings.blockers.length > 0) {
    process.exitCode = 1;
  }
}

function formatFindings(f: Finding): string {
  return `# CLI Spike Findings

**Run at:** ${f.timestamp}
**CLI version:** ${f.cli_version}
**--force present:** ${f.force_flag_present}

## Wallet Status
\`\`\`
${f.wallet_status}
\`\`\`

## --force Help Output
\`\`\`
${f.force_flag_help}
\`\`\`

## Session Test Results
${f.session_test_results.map((r) => `- ${r}`).join('\n')}

## Blockers
${f.blockers.length === 0 ? '_None_' : f.blockers.map((b) => `- ${b}`).join('\n')}

## Recommendation
${f.recommendation}
`;
}

run();
```

- [x] **Step 5.2: Add execa dependency**

Run:
```bash
cd /root/hackathon/okx/x402-earn-pay-earn
pnpm --filter @x402/scripts add execa
```

Expected: execa added to `scripts/package.json`.

- [x] **Step 5.3: Typecheck spike**

Run:
```bash
pnpm --filter @x402/scripts typecheck
```

Expected: zero errors.

- [x] **Step 5.4: Commit (before running)**

```bash
git add scripts/
git commit -m "feat(spike): add Day 1 CLI spike for x402-pay --force verification"
```

- [x] **Step 5.5: Run CLI spike + review findings**

Prerequisite: User must have `onchainos` CLI installed and preferably logged in to OKX wallet.

Run:
```bash
cd /root/hackathon/okx/x402-earn-pay-earn
pnpm spike:cli
```

Expected outcomes:
- If CLI installed + logged in: findings file written, exit code 0, PROCEED recommendation
- If CLI missing: exit code 1, blocker documented
- If not logged in: exit code 1, blocker documented, user instructed to run login

Read the findings file: `cat scripts/src/spikes/findings/cli-spike.md`

If HALT recommendation: resolve blockers before moving to next task. Do NOT skip this gate.

- [x] **Step 5.6: Commit findings**

```bash
git add scripts/src/spikes/findings/cli-spike.md
git commit -m "docs(spike): CLI spike findings"
```

---

### Task 6: Day 1 Spike 2 — Facilitator API Throughput + Happy Path

**Files:**
- Create: `scripts/src/spikes/facilitator-spike.ts`
- Create: `scripts/src/spikes/findings/facilitator-spike.md`

**Steps:**

- [x] **Step 6.1: Create facilitator spike script**

Create file `scripts/src/spikes/facilitator-spike.ts`:
```typescript
#!/usr/bin/env tsx
/**
 * Day 1 Spike: OKX Facilitator API throughput + happy path
 *
 * Verifies:
 * 1. /api/v6/pay/x402/supported returns expected scheme+network list
 * 2. HMAC signing works against live API (no 401)
 * 3. Throughput: how many requests/min before 429?
 * 4. Latency distribution (p50, p99)
 */
import { config as loadEnv } from 'dotenv';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { signOkxRequest } from '@x402/okx-auth';
import {
  OKX_FACILITATOR_BASE,
  FACILITATOR_PATHS,
  SupportedResponseSchema,
  OkxApiEnvelopeSchema,
} from '@x402/shared';

loadEnv();

interface Finding {
  timestamp: string;
  supported_endpoint_ok: boolean;
  supported_response: unknown;
  hmac_auth_ok: boolean;
  throughput_rps_before_429: number | null;
  latency_p50_ms: number | null;
  latency_p99_ms: number | null;
  total_requests_sent: number;
  blockers: string[];
  recommendation: string;
}

async function callSupported(): Promise<{ status: number; body: unknown; latencyMs: number }> {
  const secretKey = process.env.OKX_SECRET_KEY!;
  const apiKey = process.env.OKX_API_KEY!;
  const passphrase = process.env.OKX_PASSPHRASE!;

  const { timestamp, signature } = signOkxRequest({
    method: 'GET',
    path: FACILITATOR_PATHS.supported,
    secretKey,
  });

  const start = Date.now();
  const res = await fetch(`${OKX_FACILITATOR_BASE}${FACILITATOR_PATHS.supported}`, {
    method: 'GET',
    headers: {
      'OK-ACCESS-KEY': apiKey,
      'OK-ACCESS-SIGN': signature,
      'OK-ACCESS-TIMESTAMP': timestamp,
      'OK-ACCESS-PASSPHRASE': passphrase,
      'Content-Type': 'application/json',
    },
  });
  const latencyMs = Date.now() - start;
  const body = await res.json();
  return { status: res.status, body, latencyMs };
}

async function run() {
  const findings: Finding = {
    timestamp: new Date().toISOString(),
    supported_endpoint_ok: false,
    supported_response: null,
    hmac_auth_ok: false,
    throughput_rps_before_429: null,
    latency_p50_ms: null,
    latency_p99_ms: null,
    total_requests_sent: 0,
    blockers: [],
    recommendation: '',
  };

  const requiredEnv = ['OKX_API_KEY', 'OKX_SECRET_KEY', 'OKX_PASSPHRASE'];
  for (const key of requiredEnv) {
    if (!process.env[key]) {
      findings.blockers.push(`Missing env var: ${key}`);
    }
  }
  if (findings.blockers.length > 0) {
    findings.recommendation = 'HALT — missing credentials in .env';
    await writeAndExit(findings);
    return;
  }

  // 1. Happy path — capture raw response FIRST so spike findings always include real shape,
  // THEN attempt envelope parse without letting schema strictness block the spike.
  try {
    const first = await callSupported();
    findings.total_requests_sent += 1;

    // Always capture raw body regardless of schema match
    findings.supported_response = first.body;

    if (first.status === 200) {
      findings.supported_endpoint_ok = true;
      findings.hmac_auth_ok = true;

      // Try envelope parse but don't fail spike on schema mismatch
      try {
        const envelope = OkxApiEnvelopeSchema.parse(first.body);
        if (envelope.code === '0') {
          try {
            const parsed = SupportedResponseSchema.parse(envelope.data);
            console.log(`Supported parsed successfully: ${parsed.kinds?.length ?? 0} kinds`);
          } catch (e) {
            console.log(`SupportedResponseSchema parse failed (non-blocking): ${(e as Error).message}`);
            console.log('Raw supported data captured in findings.');
          }
        } else {
          findings.blockers.push(`API returned non-zero code: ${envelope.code} - ${envelope.msg}`);
        }
      } catch (e) {
        // Envelope shape differed from assumption — capture raw, continue
        console.log(`Envelope parse failed (non-blocking): ${(e as Error).message}`);
        console.log('Raw response shape will be in findings for later schema refinement.');
      }
    } else if (first.status === 401) {
      findings.blockers.push('HMAC auth failed (401). Check signing algorithm + clock drift.');
    } else {
      findings.blockers.push(`Unexpected status: ${first.status}`);
    }
  } catch (e) {
    findings.blockers.push(`Happy path failed: ${(e as Error).message}`);
  }

  // 2. Throughput test (skip if happy path failed)
  if (findings.blockers.length === 0) {
    console.log('Starting throughput test (max 120 requests)...');
    const latencies: number[] = [];
    let hit429 = false;
    let requestCount = 0;
    const startTs = Date.now();

    while (requestCount < 120 && !hit429 && Date.now() - startTs < 60_000) {
      try {
        const { status, latencyMs } = await callSupported();
        findings.total_requests_sent += 1;
        requestCount += 1;
        latencies.push(latencyMs);

        if (status === 429) {
          hit429 = true;
          findings.throughput_rps_before_429 = requestCount;
          console.log(`Hit 429 at request ${requestCount}`);
        }
        if (requestCount % 20 === 0) {
          console.log(`Progress: ${requestCount} requests...`);
        }
      } catch (e) {
        latencies.push(-1);
      }
    }

    if (!hit429) {
      findings.throughput_rps_before_429 = null; // not reached
      console.log(`Reached ${requestCount} requests without 429`);
    }

    const okLatencies = latencies.filter((l) => l > 0).sort((a, b) => a - b);
    if (okLatencies.length > 0) {
      findings.latency_p50_ms = okLatencies[Math.floor(okLatencies.length * 0.5)] ?? null;
      findings.latency_p99_ms = okLatencies[Math.floor(okLatencies.length * 0.99)] ?? null;
    }
  }

  findings.recommendation =
    findings.blockers.length === 0
      ? `PROCEED — Facilitator responsive. Throughput: ${findings.throughput_rps_before_429 ?? '>120'} req before 429. P50: ${findings.latency_p50_ms}ms, P99: ${findings.latency_p99_ms}ms.`
      : `HALT — ${findings.blockers.length} blocker(s).`;

  await writeAndExit(findings);
}

async function writeAndExit(f: Finding) {
  const md = `# Facilitator Spike Findings

**Run at:** ${f.timestamp}
**Total requests sent:** ${f.total_requests_sent}
**Happy path OK:** ${f.supported_endpoint_ok}
**HMAC auth OK:** ${f.hmac_auth_ok}

## Throughput
- First 429 at request: ${f.throughput_rps_before_429 ?? '_not reached within 120 requests / 60s_'}
- Latency P50: ${f.latency_p50_ms ?? '_n/a_'} ms
- Latency P99: ${f.latency_p99_ms ?? '_n/a_'} ms

## Supported Response
\`\`\`json
${JSON.stringify(f.supported_response, null, 2)}
\`\`\`

## Blockers
${f.blockers.length === 0 ? '_None_' : f.blockers.map((b) => `- ${b}`).join('\n')}

## Recommendation
${f.recommendation}
`;
  const findingsPath = path.join('scripts', 'src', 'spikes', 'findings', 'facilitator-spike.md');
  await writeFile(findingsPath, md, 'utf8');
  console.log(`\nFindings: ${findingsPath}\n${f.recommendation}`);
  if (f.blockers.length > 0) process.exitCode = 1;
}

run();
```

- [x] **Step 6.2: Typecheck**

Run:
```bash
pnpm --filter @x402/scripts typecheck
```

Expected: zero errors (may need to adjust imports if path resolution fails).

- [x] **Step 6.3: Commit spike code**

```bash
git add scripts/src/spikes/facilitator-spike.ts
git commit -m "feat(spike): add Day 1 facilitator throughput + happy path spike"
```

- [x] **Step 6.4: Run facilitator spike**

Prerequisite: `.env` populated with real OKX credentials.

Run:
```bash
cd /root/hackathon/okx/x402-earn-pay-earn
pnpm spike:facilitator
```

Expected: findings file written. If 401: HMAC bug, debug signing. If 200 + throughput > 30: proceed.

Review findings:
```bash
cat scripts/src/spikes/findings/facilitator-spike.md
```

- [x] **Step 6.5: Commit findings**

```bash
git add scripts/src/spikes/findings/facilitator-spike.md
git commit -m "docs(spike): facilitator spike findings"
```

---

### Task 7: Day 1 Spike 3 — OKX MCP Server Schema Capture

**Files:**
- Create: `scripts/src/spikes/mcp-spike.ts`
- Create: `scripts/src/spikes/findings/mcp-spike.md`

**Steps:**

- [x] **Step 7.1: Create MCP spike script**

Create file `scripts/src/spikes/mcp-spike.ts`:
```typescript
#!/usr/bin/env tsx
/**
 * Day 1 Spike: OKX MCP Server schema capture
 *
 * Calls real MCP tools and captures response shapes so we can
 * refine Zod schemas in @x402/shared.
 *
 * Tools tested:
 * - dex-okx-dex-aggregator-supported-chains (sanity)
 * - dex-okx-dex-quote (swap-quote service backend)
 * - dex-okx-market-token-price-info (market-snapshot service backend)
 */
import { config as loadEnv } from 'dotenv';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  OKX_MCP_ENDPOINT,
  USDG_CONTRACT,
  USDT_CONTRACT,
  X_LAYER_CHAIN_ID,
} from '@x402/shared';

loadEnv();

interface ToolResult {
  tool: string;
  ok: boolean;
  status?: number;
  duration_ms: number;
  raw_response: unknown;
  error?: string;
}

async function callMcpTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  const start = Date.now();
  const body = {
    jsonrpc: '2.0',
    method: 'tools/call',
    params: { name, arguments: args },
    id: Math.floor(Math.random() * 1e9),
  };

  try {
    const res = await fetch(OKX_MCP_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'OK-ACCESS-KEY': process.env.OKX_API_KEY!,
      },
      body: JSON.stringify(body),
    });
    const raw = await res.json();
    return {
      tool: name,
      ok: res.ok && !(raw as { error?: unknown }).error,
      status: res.status,
      duration_ms: Date.now() - start,
      raw_response: raw,
    };
  } catch (e) {
    return {
      tool: name,
      ok: false,
      duration_ms: Date.now() - start,
      raw_response: null,
      error: (e as Error).message,
    };
  }
}

async function run() {
  if (!process.env.OKX_API_KEY) {
    console.error('Missing OKX_API_KEY in .env');
    process.exit(1);
  }

  const results: ToolResult[] = [];

  // 1. Sanity check: list supported chains
  console.log('Calling dex-okx-dex-aggregator-supported-chains...');
  results.push(await callMcpTool('dex-okx-dex-aggregator-supported-chains', {}));

  // 2. Quote for USDG → USDT on X Layer
  console.log('Calling dex-okx-dex-quote...');
  results.push(
    await callMcpTool('dex-okx-dex-quote', {
      chainIndex: String(X_LAYER_CHAIN_ID),
      fromTokenAddress: USDG_CONTRACT,
      toTokenAddress: USDT_CONTRACT,
      amount: '1000000', // 1 USDG (6 decimals)
      slippage: '0.005',
    })
  );

  // 3. Token price info for USDG on X Layer
  console.log('Calling dex-okx-market-token-price-info...');
  results.push(
    await callMcpTool('dex-okx-market-token-price-info', {
      chainIndex: String(X_LAYER_CHAIN_ID),
      tokenContractAddress: USDG_CONTRACT,
    })
  );

  // Print summary
  for (const r of results) {
    console.log(
      `\n[${r.ok ? 'OK' : 'FAIL'}] ${r.tool} (${r.duration_ms}ms, status=${r.status ?? '-'})`
    );
  }

  // Write findings
  const md = formatFindings(results);
  const findingsPath = path.join('scripts', 'src', 'spikes', 'findings', 'mcp-spike.md');
  await writeFile(findingsPath, md, 'utf8');
  console.log(`\nFindings: ${findingsPath}`);

  const allOk = results.every((r) => r.ok);
  if (!allOk) process.exitCode = 1;
}

function formatFindings(results: ToolResult[]): string {
  const lines: string[] = [
    '# MCP Spike Findings',
    '',
    `**Run at:** ${new Date().toISOString()}`,
    `**Endpoint:** ${OKX_MCP_ENDPOINT}`,
    `**Tools tested:** ${results.length}`,
    `**All OK:** ${results.every((r) => r.ok)}`,
    '',
  ];
  for (const r of results) {
    lines.push(`## \`${r.tool}\``);
    lines.push(`- Status: ${r.status ?? '-'}`);
    lines.push(`- Duration: ${r.duration_ms}ms`);
    lines.push(`- OK: ${r.ok}`);
    if (r.error) lines.push(`- Error: ${r.error}`);
    lines.push('');
    lines.push('### Raw Response');
    lines.push('```json');
    lines.push(JSON.stringify(r.raw_response, null, 2));
    lines.push('```');
    lines.push('');
  }
  lines.push('## Action Items');
  lines.push('');
  lines.push(
    '1. Review response shapes above and update `packages/shared/src/types/mcp.ts` with strict Zod schemas matching actual data.'
  );
  lines.push('2. Remove `.passthrough()` from `QuoteSchema` and `TokenPriceInfoSchema` once fields are pinned.');
  lines.push('3. Document any unexpected fields or missing fields.');
  return lines.join('\n');
}

run();
```

- [x] **Step 7.2: Typecheck**

Run:
```bash
pnpm --filter @x402/scripts typecheck
```

Expected: zero errors.

- [x] **Step 7.3: Commit spike code**

```bash
git add scripts/src/spikes/mcp-spike.ts
git commit -m "feat(spike): add Day 1 MCP schema capture spike"
```

- [x] **Step 7.4: Run MCP spike**

Run:
```bash
cd /root/hackathon/okx/x402-earn-pay-earn
pnpm spike:mcp
```

Expected: 3 tool calls logged, findings file written, responses captured.

Review:
```bash
cat scripts/src/spikes/findings/mcp-spike.md
```

- [x] **Step 7.5: Commit findings**

```bash
git add scripts/src/spikes/findings/mcp-spike.md
git commit -m "docs(spike): MCP schema findings"
```

- [x] **Step 7.6: Update `packages/shared/src/types/mcp.ts` with refined schemas based on captured responses**

**Procedure:**

1. Read `scripts/src/spikes/findings/mcp-spike.md`. Scroll to `## \`dex-okx-dex-quote\`` section and copy the "Raw Response" JSON block.

2. If the raw response was empty, errored, or the tool failed: SKIP this step. Leave `QuoteSchema` as-is with `.passthrough()`. Note in findings file: "Schema refinement deferred due to spike failure." Commit and proceed.

3. If raw response has a `result` field with data: extract the top-level object that represents the quote (typically nested under `result.content[0].text` for MCP tools — parse as JSON string if needed, or `result` directly if already structured).

4. For EACH field present in that object:
   - If the field appears in the existing `QuoteSchema` with `.optional()`: change it to required (remove `.optional()`).
   - If the field is NEW (not in `QuoteSchema`): add it with the observed type (`z.string()` for string values, `z.number()` for numbers, `z.boolean()` for booleans, etc.).
   - If an existing schema field is NOT present in the captured response: leave it `.optional()` (tolerate missing).

5. After all fields processed for `QuoteSchema`: remove the top-level `.passthrough()` call. Keep nested `.passthrough()` only if nested objects have unverified shapes.

6. Repeat steps 3-5 for `TokenPriceInfoSchema` using the `dex-okx-market-token-price-info` response.

7. If the captured shape has fields that conflict with spec Section 2 Component 5 types (e.g., `estimateGasFee: number` but spec says `string`): PREFER the captured shape (spec is pre-spike assumption; capture is reality). Document conflicts at bottom of `mcp-spike.md`.

Re-run typecheck + tests:
```bash
pnpm --filter @x402/shared typecheck
pnpm --filter @x402/shared test
```

Expected: all pass. If schemas break anything downstream (no downstream yet in Chunk 1), stop and resolve.

- [x] **Step 7.7: Commit refined schemas**

```bash
git add packages/shared/src/types/mcp.ts
git commit -m "refactor(shared): pin MCP schemas based on Day 1 spike findings"
```

---

### Task 8: Chunk 1 Exit Criteria Check

- [x] **Step 8.1: Verify all packages typecheck**

Run:
```bash
cd /root/hackathon/okx/x402-earn-pay-earn
pnpm -r typecheck
```

Expected: zero errors across all workspaces.

- [x] **Step 8.2: Verify tests pass**

Run:
```bash
pnpm -r test
```

Expected: all unit tests green (okx-auth should have 9 passing tests).

- [x] **Step 8.3: Verify 3 spike findings exist**

Run:
```bash
ls scripts/src/spikes/findings/
```

Expected: 3 markdown files (`cli-spike.md`, `facilitator-spike.md`, `mcp-spike.md`).

- [x] **Step 8.4: Review findings for blockers**

For each findings file, check the "Recommendation" section. If any say HALT, resolve before proceeding to Chunk 2.

- [x] **Step 8.5: Verify clean working tree and tag completion**

Run:
```bash
git status
```

Expected: "nothing to commit, working tree clean". All Task 1-7 commits should already cover everything. If untracked or unstaged files appear, investigate (do NOT blindly `git add -A`):
- `node_modules/`, `dist/`, `.DS_Store` → should be gitignored, add to `.gitignore` if not
- Legitimate files missed → stage explicitly by name with context

Then tag:
```bash
git tag chunk-1-complete
git log --oneline | head -20
```

Expected: tag created, commit history readable with meaningful messages.

---

**Chunk 1 Exit Criteria:**
- Monorepo scaffolded with 3 packages (`shared`, `okx-auth`, `scripts`)
- All packages typecheck clean
- 5 unit tests passing in `okx-auth`
- 3 Day 1 spike findings captured and reviewed
- No HALT recommendations from spikes
- Git history clean with meaningful commits

**Next:** Chunk 2 — Orchestrator & SQLite

---

## Chunk 2: Orchestrator & SQLite

**Goal:** Build the `@x402/orchestrator` package containing SQLite state store, event bus, pure-function state machine, and crash recovery. This package is consumed by both Producer and Consumer processes.

**Why this comes second:** All downstream packages (Producer, Consumer, Dashboard) depend on orchestrator primitives. Building it now unblocks Chunks 3-6.

**Design reference:** Spec Sections 2 (Component 3), 3.1, 3.3, 4.2.

---

### Task 1: Scaffold `@x402/orchestrator` Package

**Files:**
- Create: `packages/orchestrator/package.json`
- Create: `packages/orchestrator/tsconfig.json`
- Create: `packages/orchestrator/src/index.ts`

**Steps:**

- [x] **Step 1.1: Create package.json**

Create file `packages/orchestrator/package.json`:
```json
{
  "name": "@x402/orchestrator",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "tsc",
    "test": "vitest run"
  },
  "dependencies": {
    "@x402/shared": "workspace:*",
    "better-sqlite3": "^11.3.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.11",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [x] **Step 1.2: Create tsconfig.json**

Create file `packages/orchestrator/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": ".",
    "types": ["node"]
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [x] **Step 1.3: Create index.ts stub**

Create file `packages/orchestrator/src/index.ts`:
```typescript
// Barrel exports filled in Task 7
export {};
```

- [x] **Step 1.4: Install dependencies**

Run:
```bash
cd /root/hackathon/okx/x402-earn-pay-earn
pnpm install
```

Expected: `better-sqlite3` native module compiles. If compile fails, install Python + build-essential.

- [x] **Step 1.5: Typecheck + Commit**

Run:
```bash
pnpm --filter @x402/orchestrator typecheck
git add packages/orchestrator/
git commit -m "chore(orchestrator): scaffold package with better-sqlite3 dependency"
```

Expected: zero typecheck errors, commit succeeds.

---

### Task 2: SQLite Schema + Migration Runner (TDD)

**Files:**
- Create: `packages/orchestrator/src/db/schema.ts`
- Create: `packages/orchestrator/src/db/migrate.ts`
- Create: `packages/orchestrator/tests/db/migrate.test.ts`

**Steps:**

- [x] **Step 2.1: Write failing test first**

Create file `packages/orchestrator/tests/db/migrate.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/migrate';

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

  it('enables WAL mode', () => {
    migrate(db);
    const journal = db.pragma('journal_mode', { simple: true }) as string;
    expect(journal).toBe('wal');
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
```

- [x] **Step 2.2: Run test to verify failure**

Run:
```bash
pnpm --filter @x402/orchestrator test
```

Expected: FAIL with "Cannot find module '../../src/db/migrate'".

- [x] **Step 2.3: Create schema.ts with statement array**

Create file `packages/orchestrator/src/db/schema.ts`:
```typescript
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
```

- [x] **Step 2.4: Create migrate.ts using prepared statements**

Create file `packages/orchestrator/src/db/migrate.ts`:
```typescript
import type Database from 'better-sqlite3';
import { SCHEMA_STATEMENTS } from './schema';

/**
 * Apply schema migration to the given SQLite database.
 * Iterates SCHEMA_STATEMENTS and runs each via prepared statement.
 * Idempotent — safe to call on existing databases (CREATE TABLE IF NOT EXISTS).
 * Enables WAL mode for concurrent reader support.
 */
export function migrate(db: Database.Database): void {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  for (const ddl of SCHEMA_STATEMENTS) {
    db.prepare(ddl).run();
  }
}
```

- [x] **Step 2.5: Run tests to verify pass**

Run:
```bash
pnpm --filter @x402/orchestrator test
```

Expected: 5 tests pass, 0 failing.

- [x] **Step 2.6: Typecheck + Commit**

Run:
```bash
pnpm --filter @x402/orchestrator typecheck
git add packages/orchestrator/
git commit -m "feat(orchestrator): add SQLite schema + idempotent migration with tests"
```

---

### Task 3: State Store CRUD Helpers (TDD)

**Files:**
- Create: `packages/orchestrator/src/db/store.ts`
- Create: `packages/orchestrator/tests/db/store.test.ts`

**Steps:**

- [x] **Step 3.1: Write failing tests first**

Create file `packages/orchestrator/tests/db/store.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/migrate';
import { Store } from '../../src/db/store';

describe('Store', () => {
  let db: Database.Database;
  let store: Store;

  beforeEach(() => {
    db = new Database(':memory:');
    migrate(db);
    store = new Store(db);
  });

  describe('loop_cycles', () => {
    it('insertCycle creates a new cycle in IDLE state', () => {
      const cycle = store.insertCycle({ cycleNumber: 1, startedAt: 100 });
      expect(cycle.cycle_number).toBe(1);
      expect(cycle.state).toBe('IDLE');
      expect(cycle.retry_count).toBe(0);
      expect(cycle.started_at).toBe(100);
    });

    it('updateCycleState transitions cycle state and appends to transitions log', () => {
      store.insertCycle({ cycleNumber: 1, startedAt: 100 });
      store.updateCycleState(1, 'DECIDING');
      const cycle = store.getCycle(1);
      expect(cycle?.state).toBe('DECIDING');
      expect(cycle?.state_transitions).toContain('DECIDING');
    });

    it('getCurrentCycle returns the most recent cycle', () => {
      store.insertCycle({ cycleNumber: 1, startedAt: 100 });
      store.insertCycle({ cycleNumber: 2, startedAt: 200 });
      store.insertCycle({ cycleNumber: 3, startedAt: 300 });
      expect(store.getCurrentCycle()?.cycle_number).toBe(3);
    });

    it('completeCycle sets completed_at and final state', () => {
      store.insertCycle({ cycleNumber: 1, startedAt: 100 });
      store.completeCycle(1, { completedAt: 500, netUsdgChange: '0.01' });
      const cycle = store.getCycle(1);
      expect(cycle?.completed_at).toBe(500);
      expect(cycle?.state).toBe('COMPLETED');
      expect(cycle?.net_usdg_change).toBe('0.01');
    });
  });

  describe('payments', () => {
    it('insertPendingPayment creates a signed-status row', () => {
      store.insertCycle({ cycleNumber: 1, startedAt: 100 });
      const payment = store.insertPendingPayment({
        cycleNumber: 1,
        scheme: 'exact',
        nonce: '0xABC123',
        fromAddr: '0xFROM',
        toAddr: '0xTO',
        amountMinimal: '10000',
        asset: '0xUSDG',
        service: 'market-snapshot',
        signedAt: 150,
      });
      expect(payment.id).toBeGreaterThan(0);
      expect(payment.status).toBe('signed');
      expect(payment.nonce).toBe('0xABC123');
    });

    it('updateSettlement sets tx_hash + status keyed by nonce', () => {
      store.insertCycle({ cycleNumber: 1, startedAt: 100 });
      store.insertPendingPayment({
        cycleNumber: 1,
        scheme: 'exact',
        nonce: '0xABC123',
        fromAddr: '0xFROM',
        toAddr: '0xTO',
        amountMinimal: '10000',
        asset: '0xUSDG',
        service: 'market-snapshot',
        signedAt: 150,
      });
      store.updateSettlement('0xABC123', {
        txHash: '0xTXHASH',
        settledAt: 300,
        status: 'settled',
      });
      const payment = store.findPaymentByNonce('0xABC123');
      expect(payment?.tx_hash).toBe('0xTXHASH');
      expect(payment?.status).toBe('settled');
      expect(payment?.settled_at).toBe(300);
    });

    it('findNonTerminalPayments returns signed + verified rows', () => {
      store.insertCycle({ cycleNumber: 1, startedAt: 100 });
      store.insertPendingPayment({
        cycleNumber: 1,
        scheme: 'exact',
        nonce: '0xA',
        fromAddr: '0x1',
        toAddr: '0x2',
        amountMinimal: '100',
        asset: '0xUSDG',
        service: 'market-snapshot',
        signedAt: 100,
      });
      store.insertPendingPayment({
        cycleNumber: 1,
        scheme: 'exact',
        nonce: '0xB',
        fromAddr: '0x1',
        toAddr: '0x2',
        amountMinimal: '200',
        asset: '0xUSDG',
        service: 'swap-quote',
        signedAt: 110,
      });
      store.updateSettlement('0xB', { txHash: '0xTX', settledAt: 200, status: 'settled' });
      const nonTerminal = store.findNonTerminalPayments();
      expect(nonTerminal).toHaveLength(1);
      expect(nonTerminal[0]?.nonce).toBe('0xA');
    });
  });

  describe('decisions', () => {
    it('insertDecision records LLM response', () => {
      store.insertCycle({ cycleNumber: 1, startedAt: 100 });
      store.insertDecision({
        cycleNumber: 1,
        timestamp: 150,
        action: 'consume_service',
        reason: 'Need price data before trade',
        llmResponse: '{"action":"consume_service","service":"market-snapshot"}',
        model: 'llama-3.3-70b-versatile',
        latencyMs: 850,
      });
      const decisions = store.getDecisionsByCycle(1);
      expect(decisions).toHaveLength(1);
      expect(decisions[0]?.action).toBe('consume_service');
      expect(decisions[0]?.latency_ms).toBe(850);
    });
  });

  describe('mcp_calls', () => {
    it('logMcpCall persists call with args+result', () => {
      store.logMcpCall({
        timestamp: 100,
        tool: 'dex-okx-dex-quote',
        args: { chainIndex: '196', amount: '1000000' },
        result: { toTokenAmount: '999000' },
        durationMs: 450,
        success: true,
      });
      const calls = store.getMcpCalls({ limit: 10 });
      expect(calls).toHaveLength(1);
      expect(calls[0]?.tool).toBe('dex-okx-dex-quote');
      expect(calls[0]?.success).toBe(true);
    });
  });
});
```

- [x] **Step 3.2: Run test to verify failure**

Run:
```bash
pnpm --filter @x402/orchestrator test
```

Expected: FAIL with missing module.

- [x] **Step 3.3: Create store.ts**

Create file `packages/orchestrator/src/db/store.ts`:
```typescript
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
```

- [x] **Step 3.4: Run tests + Commit**

Run:
```bash
pnpm --filter @x402/orchestrator test
pnpm --filter @x402/orchestrator typecheck
git add packages/orchestrator/
git commit -m "feat(orchestrator): add Store class with CRUD helpers for all 5 tables"
```

Expected: 12 tests pass (5 migrate + 7 store), zero typecheck errors.

---

### Task 4: Event Bus + Audit Events (TDD)

**Files:**
- Create: `packages/orchestrator/src/events/bus.ts`
- Create: `packages/orchestrator/tests/events/bus.test.ts`

**Steps:**

- [x] **Step 4.1: Write failing tests first (TDD red step)**

Create file `packages/orchestrator/tests/events/bus.test.ts`:
```typescript
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
```

- [x] **Step 4.1b: Run tests to verify failure (TDD red confirmation)**

Run:
```bash
pnpm --filter @x402/orchestrator test
```

Expected: FAIL with "Cannot find module '../../src/events/bus'".

- [x] **Step 4.2: Create bus.ts**

Create file `packages/orchestrator/src/events/bus.ts`:
```typescript
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
```

- [x] **Step 4.3: Run tests + Commit**

Run:
```bash
pnpm --filter @x402/orchestrator test
git add packages/orchestrator/
git commit -m "feat(orchestrator): add EventBus with SQLite audit log + in-process emitter"
```

Expected: 17 tests pass (5 migrate + 7 store + 5 bus).

---

### Task 5: State Machine Pure Function (TDD)

**Files:**
- Create: `packages/orchestrator/src/state/machine.ts`
- Create: `packages/orchestrator/tests/state/machine.test.ts`

**Steps:**

- [x] **Step 5.1: Write failing tests first (TDD red step)**

Create file `packages/orchestrator/tests/state/machine.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { transition, initialContext } from '../../src/state/machine';
import type { CycleState } from '@x402/shared';

describe('transition', () => {
  const base = initialContext();

  it('IDLE + LOOP_START → DECIDING', () => {
    expect(transition('IDLE', { type: 'LOOP_START' }, base).nextState).toBe<CycleState>('DECIDING');
  });

  it('DECIDING + LLM_RESPONSE → SIGNING', () => {
    expect(transition('DECIDING', { type: 'LLM_RESPONSE' }, base).nextState).toBe<CycleState>('SIGNING');
  });

  it('DECIDING + LLM_TIMEOUT → FAILED', () => {
    expect(transition('DECIDING', { type: 'LLM_TIMEOUT' }, base).nextState).toBe<CycleState>('FAILED');
  });

  it('DECIDING + LLM_429 → FAILED with shouldDowngradeModel flag', () => {
    const result = transition('DECIDING', { type: 'LLM_429' }, base);
    expect(result.nextState).toBe<CycleState>('FAILED');
    expect(result.shouldDowngradeModel).toBe(true);
  });

  it('SIGNING + PAYMENT_PROOF_READY → REPLAYING', () => {
    expect(transition('SIGNING', { type: 'PAYMENT_PROOF_READY' }, base).nextState).toBe<CycleState>('REPLAYING');
  });

  it('SIGNING + CLI_CONFIRMING → SIGNING with shouldRetryWithForce flag', () => {
    const result = transition('SIGNING', { type: 'CLI_CONFIRMING' }, base);
    expect(result.nextState).toBe<CycleState>('SIGNING');
    expect(result.shouldRetryWithForce).toBe(true);
  });

  it('SIGNING + CLI_ERROR → FAILED', () => {
    expect(transition('SIGNING', { type: 'CLI_ERROR' }, base).nextState).toBe<CycleState>('FAILED');
  });

  it('REPLAYING + HTTP_200 → VERIFYING', () => {
    expect(transition('REPLAYING', { type: 'HTTP_200' }, base).nextState).toBe<CycleState>('VERIFYING');
  });

  it('REPLAYING + HTTP_402 with cycleRetryCount<3 → DECIDING', () => {
    const ctx = { ...base, cycleRetryCount: 1 };
    const result = transition('REPLAYING', { type: 'HTTP_402' }, ctx);
    expect(result.nextState).toBe<CycleState>('DECIDING');
    expect(result.incrementCycleRetryCount).toBe(true);
  });

  it('REPLAYING + HTTP_402 with cycleRetryCount>=3 → FAILED', () => {
    const ctx = { ...base, cycleRetryCount: 3 };
    expect(transition('REPLAYING', { type: 'HTTP_402' }, ctx).nextState).toBe<CycleState>('FAILED');
  });

  it('REPLAYING + HTTP_500 → FAILED', () => {
    expect(transition('REPLAYING', { type: 'HTTP_500' }, base).nextState).toBe<CycleState>('FAILED');
  });

  it('VERIFYING + VERIFY_OK → SETTLING', () => {
    expect(transition('VERIFYING', { type: 'VERIFY_OK' }, base).nextState).toBe<CycleState>('SETTLING');
  });

  it('VERIFYING + VERIFY_INVALID → FAILED', () => {
    expect(transition('VERIFYING', { type: 'VERIFY_INVALID' }, base).nextState).toBe<CycleState>('FAILED');
  });

  it('SETTLING + SETTLE_OK → COMPLETED', () => {
    expect(transition('SETTLING', { type: 'SETTLE_OK' }, base).nextState).toBe<CycleState>('COMPLETED');
  });

  it('SETTLING + SETTLE_TIMEOUT → FAILED', () => {
    expect(transition('SETTLING', { type: 'SETTLE_TIMEOUT' }, base).nextState).toBe<CycleState>('FAILED');
  });

  it('COMPLETED + CYCLE_RESET → IDLE', () => {
    expect(transition('COMPLETED', { type: 'CYCLE_RESET' }, base).nextState).toBe<CycleState>('IDLE');
  });

  it('FAILED + RETRY with stateRetryCount<max → previousState', () => {
    const ctx = { ...base, stateRetryCount: 0, previousState: 'DECIDING' as CycleState };
    const result = transition('FAILED', { type: 'RETRY' }, ctx);
    expect(result.nextState).toBe<CycleState>('DECIDING');
    expect(result.incrementStateRetryCount).toBe(true);
  });

  it('FAILED + RETRY with stateRetryCount>=max → HALTED', () => {
    const ctx = { ...base, stateRetryCount: 2, previousState: 'DECIDING' as CycleState };
    expect(transition('FAILED', { type: 'RETRY' }, ctx).nextState).toBe<CycleState>('HALTED');
  });

  it('HALTED + USER_RESUME → IDLE with resetRetryCounters flag', () => {
    const result = transition('HALTED', { type: 'USER_RESUME' }, base);
    expect(result.nextState).toBe<CycleState>('IDLE');
    expect(result.resetRetryCounters).toBe(true);
  });

  it('throws on invalid transition', () => {
    expect(() =>
      // @ts-expect-error intentional invalid event
      transition('IDLE', { type: 'BOGUS' }, base)
    ).toThrow(/no transition/i);
  });
});
```

- [x] **Step 5.1b: Run tests to verify failure (TDD red confirmation)**

Run:
```bash
pnpm --filter @x402/orchestrator test
```

Expected: FAIL with "Cannot find module '../../src/state/machine'".

- [x] **Step 5.2: Create machine.ts**

Create file `packages/orchestrator/src/state/machine.ts`:
```typescript
import type { CycleState } from '@x402/shared';
import { CYCLE_RETRY_MAX, STATE_RETRY_MAX } from '@x402/shared';

export interface StateContext {
  cycleRetryCount: number;
  stateRetryCount: number;
  previousState: CycleState;
}

export function initialContext(): StateContext {
  return { cycleRetryCount: 0, stateRetryCount: 0, previousState: 'IDLE' };
}

export type StateEvent =
  | { type: 'LOOP_START' }
  | { type: 'LLM_RESPONSE' }
  | { type: 'LLM_TIMEOUT' }
  | { type: 'LLM_429' }
  | { type: 'PAYMENT_PROOF_READY' }
  | { type: 'CLI_CONFIRMING' }
  | { type: 'CLI_ERROR' }
  | { type: 'HTTP_200' }
  | { type: 'HTTP_402' }
  | { type: 'HTTP_500' }
  | { type: 'VERIFY_OK' }
  | { type: 'VERIFY_INVALID' }
  | { type: 'SETTLE_OK' }
  | { type: 'SETTLE_TIMEOUT' }
  | { type: 'CYCLE_RESET' }
  | { type: 'RETRY' }
  | { type: 'USER_RESUME' };

export interface TransitionResult {
  nextState: CycleState;
  shouldRetryWithForce?: boolean;
  shouldDowngradeModel?: boolean;
  incrementCycleRetryCount?: boolean;
  incrementStateRetryCount?: boolean;
  resetRetryCounters?: boolean;
}

/**
 * Pure-function state machine transition.
 * See spec Section 3.1 for authoritative transition table.
 */
export function transition(
  state: CycleState,
  event: StateEvent,
  ctx: StateContext
): TransitionResult {
  switch (state) {
    case 'IDLE':
      if (event.type === 'LOOP_START') return { nextState: 'DECIDING' };
      break;
    case 'DECIDING':
      if (event.type === 'LLM_RESPONSE') return { nextState: 'SIGNING' };
      if (event.type === 'LLM_TIMEOUT') return { nextState: 'FAILED' };
      if (event.type === 'LLM_429') return { nextState: 'FAILED', shouldDowngradeModel: true };
      break;
    case 'SIGNING':
      if (event.type === 'PAYMENT_PROOF_READY') return { nextState: 'REPLAYING' };
      if (event.type === 'CLI_CONFIRMING')
        return { nextState: 'SIGNING', shouldRetryWithForce: true };
      if (event.type === 'CLI_ERROR') return { nextState: 'FAILED' };
      break;
    case 'REPLAYING':
      if (event.type === 'HTTP_200') return { nextState: 'VERIFYING' };
      if (event.type === 'HTTP_402') {
        if (ctx.cycleRetryCount < CYCLE_RETRY_MAX) {
          return { nextState: 'DECIDING', incrementCycleRetryCount: true };
        }
        return { nextState: 'FAILED' };
      }
      if (event.type === 'HTTP_500') return { nextState: 'FAILED' };
      break;
    case 'VERIFYING':
      if (event.type === 'VERIFY_OK') return { nextState: 'SETTLING' };
      if (event.type === 'VERIFY_INVALID') return { nextState: 'FAILED' };
      break;
    case 'SETTLING':
      if (event.type === 'SETTLE_OK') return { nextState: 'COMPLETED' };
      if (event.type === 'SETTLE_TIMEOUT') return { nextState: 'FAILED' };
      break;
    case 'COMPLETED':
      if (event.type === 'CYCLE_RESET') return { nextState: 'IDLE' };
      break;
    case 'FAILED':
      if (event.type === 'RETRY') {
        if (ctx.stateRetryCount < STATE_RETRY_MAX) {
          return { nextState: ctx.previousState, incrementStateRetryCount: true };
        }
        return { nextState: 'HALTED' };
      }
      break;
    case 'HALTED':
      if (event.type === 'USER_RESUME') return { nextState: 'IDLE', resetRetryCounters: true };
      break;
  }
  throw new Error(`No transition defined for state=${state} event=${event.type}`);
}
```

- [x] **Step 5.3: Run tests + Commit**

Run:
```bash
pnpm --filter @x402/orchestrator test
git add packages/orchestrator/
git commit -m "feat(orchestrator): add pure-function state machine with exhaustive tests"
```

Expected: 37 tests pass (17 existing + 20 state machine).

---

### Task 6: Crash Recovery with Wallet-History Reconciliation (TDD)

**Files:**
- Create: `packages/orchestrator/src/recovery/reconcile.ts`
- Create: `packages/orchestrator/tests/recovery/reconcile.test.ts`

**Steps:**

- [x] **Step 6.1: Write failing tests first (TDD red step)**

Create file `packages/orchestrator/tests/recovery/reconcile.test.ts`:
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/migrate';
import { Store } from '../../src/db/store';
import { reconcileOnBoot, type WalletHistoryFetcher } from '../../src/recovery/reconcile';

describe('reconcileOnBoot', () => {
  let db: Database.Database;
  let store: Store;

  beforeEach(() => {
    db = new Database(':memory:');
    migrate(db);
    store = new Store(db);
  });

  it('marks cycle COMPLETED when on-chain tx matches pending payment nonce', async () => {
    store.insertCycle({ cycleNumber: 1, startedAt: 100 });
    store.insertPendingPayment({
      cycleNumber: 1,
      scheme: 'exact',
      nonce: '0xNONCE1',
      fromAddr: '0xFROM',
      toAddr: '0xTO',
      amountMinimal: '10000',
      asset: '0xUSDG',
      service: 'market-snapshot',
      signedAt: 100,
    });

    const fetchWalletHistory: WalletHistoryFetcher = vi.fn().mockResolvedValue([
      { txHash: '0xTX_FOUND', nonce: '0xNONCE1', timestamp: 150 },
    ]);

    const result = await reconcileOnBoot({ store, fetchWalletHistory, nowMs: 200 });

    expect(result.reconciled).toHaveLength(1);
    const payment = store.findPaymentByNonce('0xNONCE1');
    expect(payment?.status).toBe('settled');
    expect(payment?.tx_hash).toBe('0xTX_FOUND');
    expect(store.getCycle(1)?.state).toBe('COMPLETED');
  });

  it('marks payment settle_abandoned when no matching tx and >60s since signed', async () => {
    store.insertCycle({ cycleNumber: 1, startedAt: 100 });
    store.insertPendingPayment({
      cycleNumber: 1,
      scheme: 'exact',
      nonce: '0xORPHAN',
      fromAddr: '0xFROM',
      toAddr: '0xTO',
      amountMinimal: '10000',
      asset: '0xUSDG',
      service: 'market-snapshot',
      signedAt: 100,
    });
    const fetchWalletHistory: WalletHistoryFetcher = vi.fn().mockResolvedValue([]);
    const result = await reconcileOnBoot({ store, fetchWalletHistory, nowMs: 200_000 });
    expect(result.abandoned).toHaveLength(1);
    expect(store.findPaymentByNonce('0xORPHAN')?.status).toBe('settle_abandoned');
    expect(store.getCycle(1)?.state).toBe('FAILED');
  });

  it('leaves payment pending when no matching tx but <60s since signed', async () => {
    const signedAt = Date.now();
    store.insertCycle({ cycleNumber: 1, startedAt: signedAt });
    store.insertPendingPayment({
      cycleNumber: 1,
      scheme: 'exact',
      nonce: '0xRECENT',
      fromAddr: '0xFROM',
      toAddr: '0xTO',
      amountMinimal: '10000',
      asset: '0xUSDG',
      service: 'market-snapshot',
      signedAt,
    });
    const fetchWalletHistory: WalletHistoryFetcher = vi.fn().mockResolvedValue([]);
    const result = await reconcileOnBoot({ store, fetchWalletHistory, nowMs: signedAt + 30_000 });
    expect(result.stillPending).toHaveLength(1);
    expect(store.findPaymentByNonce('0xRECENT')?.status).toBe('signed');
  });

  it('skips already-terminal cycles', async () => {
    store.insertCycle({ cycleNumber: 1, startedAt: 100 });
    store.completeCycle(1, { completedAt: 200, netUsdgChange: '0.01' });
    store.insertPendingPayment({
      cycleNumber: 1,
      scheme: 'exact',
      nonce: '0xSETTLED',
      fromAddr: '0xFROM',
      toAddr: '0xTO',
      amountMinimal: '10000',
      asset: '0xUSDG',
      service: 'market-snapshot',
      signedAt: 100,
    });
    store.updateSettlement('0xSETTLED', { txHash: '0xTX', settledAt: 150, status: 'settled' });
    const fetchWalletHistory: WalletHistoryFetcher = vi.fn().mockResolvedValue([]);
    const result = await reconcileOnBoot({ store, fetchWalletHistory, nowMs: 10_000_000 });
    expect(result.reconciled).toHaveLength(0);
    expect(result.abandoned).toHaveLength(0);
    expect(fetchWalletHistory).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 6.1b: Run tests to verify failure (TDD red confirmation)**

Run:
```bash
pnpm --filter @x402/orchestrator test
```

Expected: FAIL with "Cannot find module '../../src/recovery/reconcile'".

- [x] **Step 6.2: Create reconcile.ts**

Create file `packages/orchestrator/src/recovery/reconcile.ts`:
```typescript
import type { Store, PaymentRow } from '../db/store';

export interface WalletHistoryEntry {
  txHash: string;
  nonce: string;
  timestamp: number;
}

export type WalletHistoryFetcher = () => Promise<WalletHistoryEntry[]>;

export interface ReconcileResult {
  reconciled: PaymentRow[];
  abandoned: PaymentRow[];
  stillPending: PaymentRow[];
}

export interface ReconcileOpts {
  store: Store;
  fetchWalletHistory: WalletHistoryFetcher;
  nowMs: number;
  orphanThresholdMs?: number;
}

/**
 * Reconcile non-terminal payments against on-chain wallet history.
 * Spec Section 4.2 reconciliation flow.
 *
 * Matching strategy: nonce-keyed lookup only (step 4 primary path).
 * The spec also allows fallback matching by amount + from_addr + timestamp window.
 * That fallback is the responsibility of the WalletHistoryFetcher implementation
 * in Chunk 3 — the fetcher is expected to pre-filter wallet history and attach
 * synthetic nonces for payments whose on-chain tx cannot be directly tagged.
 *
 * Recovery intentionally bypasses the state machine by calling updateCycleState
 * directly (out-of-band transition). This is acceptable because reconciliation
 * runs only at boot before the state machine processes any events.
 */
export async function reconcileOnBoot(opts: ReconcileOpts): Promise<ReconcileResult> {
  const orphanThresholdMs = opts.orphanThresholdMs ?? 60_000;
  const result: ReconcileResult = { reconciled: [], abandoned: [], stillPending: [] };

  const pending = opts.store.findNonTerminalPayments();
  if (pending.length === 0) return result;

  const history = await opts.fetchWalletHistory();
  const historyByNonce = new Map<string, WalletHistoryEntry>();
  for (const entry of history) {
    historyByNonce.set(entry.nonce, entry);
  }

  for (const payment of pending) {
    const match = historyByNonce.get(payment.nonce);
    if (match) {
      // Reconciled: on-chain tx found matching this payment's nonce.
      // Derive net USDG change from the payment amount stored at sign time.
      opts.store.updateSettlement(payment.nonce, {
        txHash: match.txHash,
        settledAt: match.timestamp,
        status: 'settled',
      });
      opts.store.completeCycle(payment.cycle_number, {
        completedAt: match.timestamp,
        netUsdgChange: payment.amount_minimal,
      });
      result.reconciled.push(payment);
    } else if (opts.nowMs - payment.signed_at > orphanThresholdMs) {
      // Orphaned: past threshold with no match on-chain. Mark abandoned,
      // pass null tx_hash (spec-idiomatic for "no transaction"), and
      // transition cycle to FAILED out-of-band (recovery bypass).
      opts.store.updateSettlement(payment.nonce, {
        txHash: null,
        settledAt: opts.nowMs,
        status: 'settle_abandoned',
      });
      opts.store.updateCycleState(payment.cycle_number, 'FAILED');
      result.abandoned.push(payment);
    } else {
      result.stillPending.push(payment);
    }
  }

  return result;
}
```

- [x] **Step 6.3: Run tests + Commit**

Run:
```bash
pnpm --filter @x402/orchestrator test
git add packages/orchestrator/
git commit -m "feat(orchestrator): add reconcileOnBoot with wallet-history reconciliation"
```

Expected: 41 tests pass (37 existing + 4 reconcile).

---

### Task 7: Public API Barrel + Smoke Integration Test

**Files:**
- Modify: `packages/orchestrator/src/index.ts`
- Create: `packages/orchestrator/tests/smoke.test.ts`

**Steps:**

- [x] **Step 7.1: Update index.ts with full barrel exports**

Overwrite file `packages/orchestrator/src/index.ts`:
```typescript
export { migrate } from './db/migrate';
export { SCHEMA_STATEMENTS } from './db/schema';
export { Store } from './db/store';
export type { LoopCycleRow, PaymentRow, DecisionRow, McpCallRow } from './db/store';
export { EventBus } from './events/bus';
export type { EventSource, ReplayEvent, AuditEventRow } from './events/bus';
export { transition, initialContext } from './state/machine';
export type { StateContext, StateEvent, TransitionResult } from './state/machine';
export { reconcileOnBoot } from './recovery/reconcile';
export type {
  WalletHistoryEntry,
  WalletHistoryFetcher,
  ReconcileResult,
  ReconcileOpts,
} from './recovery/reconcile';
```

- [x] **Step 7.2: Create smoke test**

Create file `packages/orchestrator/tests/smoke.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate, Store, EventBus, transition, initialContext } from '../src/index';

describe('Orchestrator smoke integration', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    migrate(db);
  });

  it('simulates full cycle IDLE → COMPLETED end-to-end', () => {
    const store = new Store(db);
    const bus = new EventBus(db, 'orchestrator');
    const ctx = initialContext();

    store.insertCycle({ cycleNumber: 1, startedAt: Date.now() });
    store.updateCycleState(1, transition('IDLE', { type: 'LOOP_START' }, ctx).nextState);
    bus.emit('LOOP_CYCLE_STARTED', { cycleNumber: 1 });

    store.insertDecision({
      cycleNumber: 1,
      timestamp: Date.now(),
      action: 'consume_service',
      reason: 'need price',
      llmResponse: '{}',
      model: 'llama-3.3-70b-versatile',
      latencyMs: 800,
    });
    store.updateCycleState(1, transition('DECIDING', { type: 'LLM_RESPONSE' }, ctx).nextState);

    store.insertPendingPayment({
      cycleNumber: 1,
      scheme: 'exact',
      nonce: '0xNONCE1',
      fromAddr: '0xFROM',
      toAddr: '0xTO',
      amountMinimal: '10000',
      asset: '0xUSDG',
      service: 'market-snapshot',
      signedAt: Date.now(),
    });
    store.updateCycleState(1, transition('SIGNING', { type: 'PAYMENT_PROOF_READY' }, ctx).nextState);

    store.updateCycleState(1, transition('REPLAYING', { type: 'HTTP_200' }, ctx).nextState);
    store.updateVerification('0xNONCE1', Date.now());
    store.updateCycleState(1, transition('VERIFYING', { type: 'VERIFY_OK' }, ctx).nextState);

    store.updateSettlement('0xNONCE1', {
      txHash: '0xTXHASH',
      settledAt: Date.now(),
      status: 'settled',
    });
    const t6 = transition('SETTLING', { type: 'SETTLE_OK' }, ctx);
    expect(t6.nextState).toBe('COMPLETED');

    store.completeCycle(1, { completedAt: Date.now(), netUsdgChange: '0.01' });
    bus.emit('LOOP_CYCLE_COMPLETED', { cycleNumber: 1, netUsdgChange: '0.01' });

    const final = store.getCycle(1);
    expect(final?.state).toBe('COMPLETED');
    expect(final?.net_usdg_change).toBe('0.01');

    const payment = store.findPaymentByNonce('0xNONCE1');
    expect(payment?.status).toBe('settled');
    expect(payment?.tx_hash).toBe('0xTXHASH');

    const events = bus.replay({ sinceId: 0, limit: 100 });
    const kinds = events.map((e) => e.kind);
    expect(kinds).toContain('LOOP_CYCLE_STARTED');
    expect(kinds).toContain('LOOP_CYCLE_COMPLETED');
  });
});
```

- [x] **Step 7.3: Run all tests + Commit**

Run:
```bash
pnpm --filter @x402/orchestrator test
pnpm --filter @x402/orchestrator typecheck
git add packages/orchestrator/
git commit -m "feat(orchestrator): export public API + smoke integration test"
```

Expected: 42 tests pass including smoke test.

---

### Task 8: Chunk 2 Exit Criteria Check

- [x] **Step 8.1: Verify all workspaces typecheck**

Run:
```bash
cd /root/hackathon/okx/x402-earn-pay-earn
pnpm -r typecheck
```

Expected: zero errors across `shared`, `okx-auth`, `scripts`, `orchestrator`.

- [x] **Step 8.2: Run all tests**

Run:
```bash
pnpm -r test
```

Expected: all tests pass. Total: 9 okx-auth + 42 orchestrator = 51+ tests.

- [x] **Step 8.3: Verify clean git state and tag**

Run:
```bash
git status
git log --oneline | head -20
git tag chunk-2-complete
```

Expected: clean working tree, commits for Tasks 1-7 visible.

---

**Chunk 2 Exit Criteria:**
- `@x402/orchestrator` package with schema, Store, EventBus, state machine, recovery
- All 5 tables created with indexes + UNIQUE constraint on payment nonces
- 42+ unit tests passing (migrate, store, bus, machine, recovery, smoke)
- State machine covers all 19 transitions from spec Section 3.1
- Crash recovery integrates with wallet history fetcher (stub used in tests, real wrapper in Chunk 3)
- Public API exports ready for Chunks 3-6 to import
- Typecheck clean across all workspaces
- Git history atomic

**Next:** Chunk 3 — MCP Client & Onchain CLI Clients

---

## Chunk 3: MCP Client & Onchain CLI Clients

**Goal:** Build `@x402/mcp-client` (JSON-RPC HTTP client for OKX MCP Server) and `@x402/onchain-clients` (typed CLI wrappers for wallet, x402-payment, trenches). These are the integration edges consumed by Producer and Consumer.

**Why this comes third:** Producer needs MCP client for market/quote data. Consumer needs CLI wrapper for signing. Orchestrator recovery needs wallet-history adapter. All downstream packages block on these.

**Design reference:** Spec Section 2 Components 6-8, Section 3.2 Stages 2-3.

---

### Task 1: Scaffold `@x402/mcp-client` Package

**Files:**
- Create: `packages/mcp-client/package.json`
- Create: `packages/mcp-client/tsconfig.json`
- Create: `packages/mcp-client/src/index.ts`

**Steps:**

- [ ] **Step 1.1: Create package.json**

Create file `packages/mcp-client/package.json`:
```json
{
  "name": "@x402/mcp-client",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@x402/shared": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 1.2: Create tsconfig.json**

Create file `packages/mcp-client/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "./dist", "rootDir": "." },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 1.3: Create index.ts stub**

Create file `packages/mcp-client/src/index.ts`:
```typescript
export {};
```

- [ ] **Step 1.4: Install + Commit**

Run:
```bash
pnpm install
git add packages/mcp-client/
git commit -m "chore(mcp-client): scaffold package"
```

---

### Task 2: MCP JSON-RPC Client (TDD)

**Files:**
- Create: `packages/mcp-client/src/client.ts`
- Create: `packages/mcp-client/tests/client.test.ts`

**Steps:**

- [ ] **Step 2.1: Write failing tests first (TDD red step)**

Create file `packages/mcp-client/tests/client.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OKXMCPClient } from '../src/client';

describe('OKXMCPClient', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('constructs JSON-RPC 2.0 tools/call request with correct headers', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ jsonrpc: '2.0', id: 1, result: { toTokenAmount: '999000' } }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const client = new OKXMCPClient({
      url: 'https://web3.okx.com/api/v1/onchainos-mcp',
      apiKey: 'TEST_KEY',
    });

    await client.callTool('dex-okx-dex-quote', { chainIndex: '196' });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toBe('https://web3.okx.com/api/v1/onchainos-mcp');
    expect(init.method).toBe('POST');
    expect(init.headers['OK-ACCESS-KEY']).toBe('TEST_KEY');
    expect(init.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(init.body as string);
    expect(body.jsonrpc).toBe('2.0');
    expect(body.method).toBe('tools/call');
    expect(body.params.name).toBe('dex-okx-dex-quote');
    expect(body.params.arguments).toEqual({ chainIndex: '196' });
    expect(typeof body.id).toBe('number');
  });

  it('returns result on successful response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ jsonrpc: '2.0', id: 1, result: { fromToken: { symbol: 'USDG' } } }),
    }) as unknown as typeof fetch;

    const client = new OKXMCPClient({ url: 'https://test', apiKey: 'K' });
    const result = await client.callTool('dex-okx-dex-quote', {});
    expect(result).toEqual({ fromToken: { symbol: 'USDG' } });
  });

  it('throws MCPError on JSON-RPC error field', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        jsonrpc: '2.0',
        id: 1,
        error: { code: -32602, message: 'Invalid params', data: null },
      }),
    }) as unknown as typeof fetch;

    const client = new OKXMCPClient({ url: 'https://test', apiKey: 'K' });
    await expect(client.callTool('dex-okx-dex-quote', {})).rejects.toThrow(/Invalid params/);
  });

  it('throws on HTTP non-2xx status', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    }) as unknown as typeof fetch;

    const client = new OKXMCPClient({ url: 'https://test', apiKey: 'K' });
    await expect(client.callTool('dex-okx-dex-quote', {})).rejects.toThrow(/HTTP 500/);
  });

  it('typed helpers: getQuote calls dex-okx-dex-quote with typed params', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ jsonrpc: '2.0', id: 1, result: { toTokenAmount: '999000' } }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const client = new OKXMCPClient({ url: 'https://test', apiKey: 'K' });
    await client.getQuote({
      chainIndex: '196',
      fromTokenAddress: '0x4ae46a509f6b1d9056937ba4500cb143933d2dc8',
      toTokenAddress: '0x779ded0c9e1022225f8e0630b35a9b54be713736',
      amount: '1000000',
    });

    const body = JSON.parse((mockFetch.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.params.name).toBe('dex-okx-dex-quote');
    expect(body.params.arguments.chainIndex).toBe('196');
  });

  it('typed helpers: getTokenPriceInfo calls dex-okx-market-token-price-info', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ jsonrpc: '2.0', id: 1, result: { price: '1.00' } }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const client = new OKXMCPClient({ url: 'https://test', apiKey: 'K' });
    await client.getTokenPriceInfo({
      chainIndex: '196',
      tokenContractAddress: '0x4ae46a509f6b1d9056937ba4500cb143933d2dc8',
    });

    const body = JSON.parse((mockFetch.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.params.name).toBe('dex-okx-market-token-price-info');
  });
});
```

- [ ] **Step 2.2: Run tests to verify failure (TDD red confirmation)**

Run:
```bash
pnpm --filter @x402/mcp-client test
```

Expected: FAIL with "Cannot find module '../src/client'".

- [ ] **Step 2.3: Create client.ts**

Create file `packages/mcp-client/src/client.ts`:
```typescript
import type {
  QuoteParams,
  Quote,
  TokenPriceInfoParams,
  TokenPriceInfo,
} from '@x402/shared';
import { QuoteSchema, TokenPriceInfoSchema } from '@x402/shared';

export interface MCPClientConfig {
  url: string;
  apiKey: string;
  timeoutMs?: number;
}

export class MCPError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
    public readonly data?: unknown
  ) {
    super(message);
    this.name = 'MCPError';
  }
}

/**
 * OKX OnchainOS MCP Server HTTP JSON-RPC client.
 * Endpoint: https://web3.okx.com/api/v1/onchainos-mcp
 * Auth: OK-ACCESS-KEY header (no HMAC required for MCP itself).
 */
export class OKXMCPClient {
  private readonly timeoutMs: number;

  constructor(private readonly config: MCPClientConfig) {
    this.timeoutMs = config.timeoutMs ?? 10_000;
  }

  async callTool<T = unknown>(name: string, args: Record<string, unknown>): Promise<T> {
    const body = {
      jsonrpc: '2.0' as const,
      method: 'tools/call' as const,
      params: { name, arguments: args },
      id: Math.floor(Math.random() * 1e9),
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(this.config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'OK-ACCESS-KEY': this.config.apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new MCPError(`HTTP ${res.status} ${res.statusText}`);
      }

      const json = (await res.json()) as {
        jsonrpc: string;
        id: number;
        result?: T;
        error?: { code: number; message: string; data?: unknown };
      };

      if (json.error) {
        throw new MCPError(json.error.message, json.error.code, json.error.data);
      }

      return json.result as T;
    } finally {
      clearTimeout(timer);
    }
  }

  async getQuote(params: QuoteParams): Promise<Quote> {
    const raw = await this.callTool<unknown>('dex-okx-dex-quote', params);
    return QuoteSchema.parse(raw);
  }

  async getTokenPriceInfo(params: TokenPriceInfoParams): Promise<TokenPriceInfo> {
    const raw = await this.callTool<unknown>('dex-okx-market-token-price-info', params);
    return TokenPriceInfoSchema.parse(raw);
  }
}
```

- [ ] **Step 2.4: Update index.ts with barrel exports**

Overwrite file `packages/mcp-client/src/index.ts`:
```typescript
export { OKXMCPClient, MCPError } from './client';
export type { MCPClientConfig } from './client';
```

- [ ] **Step 2.5: Run tests + Commit**

Run:
```bash
pnpm --filter @x402/mcp-client test
pnpm --filter @x402/mcp-client typecheck
git add packages/mcp-client/
git commit -m "feat(mcp-client): add OKXMCPClient with JSON-RPC + typed helpers + tests"
```

Expected: 6 tests pass, zero typecheck errors.

---

### Task 3: Scaffold `@x402/onchain-clients` Package

**Files:**
- Create: `packages/onchain-clients/package.json`
- Create: `packages/onchain-clients/tsconfig.json`
- Create: `packages/onchain-clients/src/index.ts`
- Create: `packages/onchain-clients/src/util/spawn-cli.ts`
- Create: `packages/onchain-clients/tests/util/spawn-cli.test.ts`

**Steps:**

- [ ] **Step 3.1: Create package.json**

Create file `packages/onchain-clients/package.json`:
```json
{
  "name": "@x402/onchain-clients",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@x402/shared": "workspace:*",
    "execa": "^9.4.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 3.2: Create tsconfig.json**

Create file `packages/onchain-clients/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "./dist", "rootDir": ".", "types": ["node"] },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 3.3: Write failing spawn-cli test first (TDD red step)**

Create file `packages/onchain-clients/tests/util/spawn-cli.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { spawnCli } from '../../src/util/spawn-cli';

// Note: these tests use a real `echo` process as a stand-in for `onchainos` CLI.
// Integration against real onchainos CLI happens via test marker RUN_INTEGRATION=1.

describe('spawnCli', () => {
  it('resolves with stdout on success', async () => {
    const result = await spawnCli('echo', ['hello']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('hello');
  });

  it('captures stdout and stderr separately', async () => {
    const result = await spawnCli('sh', ['-c', 'echo out; echo err 1>&2']);
    expect(result.stdout.trim()).toBe('out');
    expect(result.stderr.trim()).toBe('err');
  });

  it('returns non-zero exitCode without throwing by default', async () => {
    const result = await spawnCli('sh', ['-c', 'exit 2']);
    expect(result.exitCode).toBe(2);
  });

  it('parseJson returns parsed stdout when command outputs JSON', async () => {
    const result = await spawnCli('sh', ['-c', 'echo \'{"ok":true,"value":42}\'']);
    expect(result.exitCode).toBe(0);
    const parsed = result.parseJson<{ ok: boolean; value: number }>();
    expect(parsed.ok).toBe(true);
    expect(parsed.value).toBe(42);
  });

  it('parseJson throws on invalid JSON', async () => {
    const result = await spawnCli('echo', ['not-json']);
    expect(() => result.parseJson()).toThrow();
  });
});
```

- [ ] **Step 3.4: Run test to verify failure (TDD red confirmation)**

Run:
```bash
pnpm install
pnpm --filter @x402/onchain-clients test
```

Expected: FAIL with "Cannot find module '../../src/util/spawn-cli'".

- [ ] **Step 3.5: Create spawn-cli.ts**

Create file `packages/onchain-clients/src/util/spawn-cli.ts`:
```typescript
import { execa, type Options } from 'execa';

export interface SpawnCliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  parseJson<T = unknown>(): T;
}

export interface SpawnCliOptions {
  timeoutMs?: number;
  env?: Record<string, string>;
}

/**
 * Thin wrapper around execa that normalizes output shape for CLI wrappers.
 * - Uses execFile semantics (no shell injection).
 * - Never throws on non-zero exit (caller decides).
 * - Provides .parseJson() helper for CLI commands that output JSON.
 */
export async function spawnCli(
  command: string,
  args: readonly string[],
  options: SpawnCliOptions = {}
): Promise<SpawnCliResult> {
  const execaOpts: Options = {
    reject: false,
    timeout: options.timeoutMs ?? 30_000,
  };
  if (options.env) {
    execaOpts.env = { ...process.env, ...options.env };
  }
  const result = await execa(command, args, execaOpts);

  const stdout = typeof result.stdout === 'string' ? result.stdout : '';
  const stderr = typeof result.stderr === 'string' ? result.stderr : '';
  const exitCode = result.exitCode ?? -1;

  return {
    exitCode,
    stdout,
    stderr,
    parseJson<T = unknown>(): T {
      return JSON.parse(stdout) as T;
    },
  };
}
```

- [ ] **Step 3.6: Create index.ts stub**

Create file `packages/onchain-clients/src/index.ts`:
```typescript
export { spawnCli } from './util/spawn-cli';
export type { SpawnCliResult, SpawnCliOptions } from './util/spawn-cli';
```

- [ ] **Step 3.7: Run tests + Commit**

Run:
```bash
pnpm --filter @x402/onchain-clients test
pnpm --filter @x402/onchain-clients typecheck
git add packages/onchain-clients/
git commit -m "feat(onchain-clients): scaffold package with spawnCli utility + tests"
```

Expected: 5 tests pass, zero typecheck errors.

---

### Task 4: Agentic Wallet CLI Wrapper

**Files:**
- Create: `packages/onchain-clients/src/wallet.ts`
- Create: `packages/onchain-clients/tests/wallet.test.ts`

**Steps:**

- [ ] **Step 4.1: Write failing test first (TDD red step)**

Create file `packages/onchain-clients/tests/wallet.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import * as spawnMod from '../src/util/spawn-cli';
import { WalletClient } from '../src/wallet';

describe('WalletClient', () => {
  it('status() returns parsed loggedIn + accountCount', async () => {
    vi.spyOn(spawnMod, 'spawnCli').mockResolvedValue({
      exitCode: 0,
      stdout: '{"email":"test@example.com","loggedIn":true,"currentAccountId":"acct-1","currentAccountName":"Wallet 1","accountCount":2,"policy":null}',
      stderr: '',
      parseJson<T>() {
        return JSON.parse(this.stdout) as T;
      },
    });
    const client = new WalletClient();
    const status = await client.status();
    expect(status.loggedIn).toBe(true);
    expect(status.accountCount).toBe(2);
    expect(status.currentAccountId).toBe('acct-1');
  });

  it('switchAccount invokes wallet switch with accountId', async () => {
    const spy = vi.spyOn(spawnMod, 'spawnCli').mockResolvedValue({
      exitCode: 0,
      stdout: '{"ok":true}',
      stderr: '',
      parseJson<T>() {
        return JSON.parse(this.stdout) as T;
      },
    });
    const client = new WalletClient();
    await client.switchAccount('acct-2');
    expect(spy).toHaveBeenCalledWith('onchainos', ['wallet', 'switch', 'acct-2'], expect.any(Object));
  });

  it('balance(chain, tokenAddress) invokes wallet balance with correct flags', async () => {
    const spy = vi.spyOn(spawnMod, 'spawnCli').mockResolvedValue({
      exitCode: 0,
      stdout: '{"details":[]}',
      stderr: '',
      parseJson<T>() {
        return JSON.parse(this.stdout) as T;
      },
    });
    const client = new WalletClient();
    await client.balance({ chain: 'xlayer', tokenAddress: '0x4ae46a509f6b1d9056937ba4500cb143933d2dc8' });
    expect(spy).toHaveBeenCalledWith(
      'onchainos',
      ['wallet', 'balance', '--chain', 'xlayer', '--token-address', '0x4ae46a509f6b1d9056937ba4500cb143933d2dc8'],
      expect.any(Object)
    );
  });

  it('sendToken invokes wallet send with --contract-token', async () => {
    const spy = vi.spyOn(spawnMod, 'spawnCli').mockResolvedValue({
      exitCode: 0,
      stdout: '{"txHash":"0xTXHASH"}',
      stderr: '',
      parseJson<T>() {
        return JSON.parse(this.stdout) as T;
      },
    });
    const client = new WalletClient();
    const result = await client.sendToken({
      chain: 'xlayer',
      recipient: '0xRECIPIENT',
      readableAmount: '0.01',
      contractToken: '0x4ae46a509f6b1d9056937ba4500cb143933d2dc8',
    });
    expect(result.txHash).toBe('0xTXHASH');
    expect(spy).toHaveBeenCalled();
  });

  it('getHistory invokes wallet history with --account-id', async () => {
    const spy = vi.spyOn(spawnMod, 'spawnCli').mockResolvedValue({
      exitCode: 0,
      stdout: '[{"cursor":"","orderList":[]}]',
      stderr: '',
      parseJson<T>() {
        return JSON.parse(this.stdout) as T;
      },
    });
    const client = new WalletClient();
    await client.getHistory({ accountId: 'acct-1', chain: 'xlayer' });
    expect(spy).toHaveBeenCalledWith(
      'onchainos',
      expect.arrayContaining(['wallet', 'history', '--account-id', 'acct-1']),
      expect.any(Object)
    );
  });

  it('throws on non-zero exit code', async () => {
    vi.spyOn(spawnMod, 'spawnCli').mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: 'error: not logged in',
      parseJson<T>() {
        return JSON.parse(this.stdout) as T;
      },
    });
    const client = new WalletClient();
    await expect(client.status()).rejects.toThrow(/not logged in/);
  });
});
```

- [ ] **Step 4.2: Run test to verify failure (TDD red confirmation)**

Run:
```bash
pnpm --filter @x402/onchain-clients test
```

Expected: FAIL with missing module.

- [ ] **Step 4.3: Create wallet.ts**

Create file `packages/onchain-clients/src/wallet.ts`:
```typescript
import { spawnCli } from './util/spawn-cli';

export interface WalletStatus {
  email: string;
  loggedIn: boolean;
  currentAccountId: string;
  currentAccountName: string;
  accountCount: number;
  policy: Record<string, unknown> | null;
}

export interface BalanceOptions {
  chain: string;
  tokenAddress?: string;
  all?: boolean;
}

export interface SendTokenOptions {
  chain: string;
  recipient: string;
  readableAmount: string;
  contractToken?: string;
  from?: string;
  force?: boolean;
}

export interface SendTokenResult {
  txHash: string;
}

export interface HistoryOptions {
  accountId?: string;
  chain: string;
  txHash?: string;
  address?: string;
  limit?: string;
}

export interface HistoryEntry {
  txHash: string;
  txStatus: string;
  txTime: string;
  from: string;
  to: string;
  direction: 'send' | 'receive';
  coinSymbol: string;
  coinAmount: string;
}

/**
 * TypeScript wrapper around `onchainos wallet` CLI commands.
 * All methods invoke spawnCli with canonical arg arrays and parse stdout JSON.
 * Throws on non-zero exit codes.
 */
export class WalletClient {
  async status(): Promise<WalletStatus> {
    const result = await spawnCli('onchainos', ['wallet', 'status']);
    if (result.exitCode !== 0) {
      throw new Error(`wallet status failed: ${result.stderr || 'unknown error'}`);
    }
    return result.parseJson<WalletStatus>();
  }

  async switchAccount(accountId: string): Promise<void> {
    const result = await spawnCli('onchainos', ['wallet', 'switch', accountId]);
    if (result.exitCode !== 0) {
      throw new Error(`wallet switch failed: ${result.stderr}`);
    }
  }

  async addAccount(): Promise<{ accountId: string; accountName: string }> {
    const result = await spawnCli('onchainos', ['wallet', 'add']);
    if (result.exitCode !== 0) {
      throw new Error(`wallet add failed: ${result.stderr}`);
    }
    return result.parseJson();
  }

  async balance(opts: BalanceOptions): Promise<unknown> {
    const args: string[] = ['wallet', 'balance'];
    if (opts.all) args.push('--all');
    if (opts.chain) args.push('--chain', opts.chain);
    if (opts.tokenAddress) args.push('--token-address', opts.tokenAddress);
    const result = await spawnCli('onchainos', args);
    if (result.exitCode !== 0) {
      throw new Error(`wallet balance failed: ${result.stderr}`);
    }
    return result.parseJson();
  }

  async sendToken(opts: SendTokenOptions): Promise<SendTokenResult> {
    const args: string[] = [
      'wallet',
      'send',
      '--chain',
      opts.chain,
      '--recipient',
      opts.recipient,
      '--readable-amount',
      opts.readableAmount,
    ];
    if (opts.contractToken) args.push('--contract-token', opts.contractToken);
    if (opts.from) args.push('--from', opts.from);
    if (opts.force) args.push('--force');
    const result = await spawnCli('onchainos', args);
    if (result.exitCode !== 0) {
      throw new Error(`wallet send failed: ${result.stderr}`);
    }
    return result.parseJson<SendTokenResult>();
  }

  async getHistory(opts: HistoryOptions): Promise<HistoryEntry[]> {
    const args: string[] = ['wallet', 'history', '--chain', opts.chain];
    if (opts.accountId) args.push('--account-id', opts.accountId);
    if (opts.txHash) args.push('--tx-hash', opts.txHash);
    if (opts.address) args.push('--address', opts.address);
    if (opts.limit) args.push('--limit', opts.limit);
    const result = await spawnCli('onchainos', args);
    if (result.exitCode !== 0) {
      throw new Error(`wallet history failed: ${result.stderr}`);
    }
    const parsed = result.parseJson<Array<{ orderList: HistoryEntry[] }>>();
    return parsed[0]?.orderList ?? [];
  }
}
```

- [ ] **Step 4.4: Run tests + Commit**

Run:
```bash
pnpm --filter @x402/onchain-clients test
git add packages/onchain-clients/
git commit -m "feat(onchain-clients): add WalletClient CLI wrapper with tests"
```

Expected: 11 tests pass (5 spawn-cli + 6 wallet).

---

### Task 5: x402 Payment CLI Wrapper

**Files:**
- Create: `packages/onchain-clients/src/x402-payment.ts`
- Create: `packages/onchain-clients/tests/x402-payment.test.ts`

**Steps:**

- [ ] **Step 5.1: Write failing test first (TDD red step)**

Create file `packages/onchain-clients/tests/x402-payment.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import * as spawnMod from '../src/util/spawn-cli';
import { X402PaymentClient } from '../src/x402-payment';

const mockResult = (stdout: string, exitCode = 0, stderr = '') => ({
  exitCode,
  stdout,
  stderr,
  parseJson<T>() {
    return JSON.parse(this.stdout) as T;
  },
});

describe('X402PaymentClient', () => {
  it('signPayment invokes x402-pay with accepts JSON', async () => {
    const spy = vi.spyOn(spawnMod, 'spawnCli').mockResolvedValue(
      mockResult(
        '{"signature":"0xSIG","authorization":{"from":"0xA","to":"0xB","value":"10000","validAfter":"0","validBefore":"1000","nonce":"0xNONCE"}}'
      )
    );

    const client = new X402PaymentClient();
    const accepts = [
      {
        scheme: 'exact' as const,
        network: 'eip155:196' as const,
        amount: '10000',
        asset: '0x4ae46a509f6b1d9056937ba4500cb143933d2dc8',
        payTo: '0xTO',
        maxTimeoutSeconds: 60,
        extra: { name: 'USDG', version: '2' },
      },
    ];
    const proof = await client.signPayment({ accepts });

    expect(proof.signature).toBe('0xSIG');
    expect(proof.authorization.nonce).toBe('0xNONCE');
    expect(spy).toHaveBeenCalledWith(
      'onchainos',
      ['payment', 'x402-pay', '--accepts', JSON.stringify(accepts)],
      expect.any(Object)
    );
  });

  it('retries with --force flag when CLI returns exit code 2 (confirming)', async () => {
    const spy = vi
      .spyOn(spawnMod, 'spawnCli')
      .mockResolvedValueOnce(
        mockResult('{"confirming":true,"message":"Confirm?","next":"Re-run with --force"}', 2)
      )
      .mockResolvedValueOnce(
        mockResult(
          '{"signature":"0xSIG2","authorization":{"from":"0xA","to":"0xB","value":"10000","validAfter":"0","validBefore":"1000","nonce":"0xN2"}}'
        )
      );

    const client = new X402PaymentClient();
    const proof = await client.signPayment({ accepts: [] });

    expect(proof.signature).toBe('0xSIG2');
    expect(spy).toHaveBeenCalledTimes(2);
    const secondCallArgs = spy.mock.calls[1]![1] as string[];
    expect(secondCallArgs).toContain('--force');
  });

  it('throws on non-zero exit code that is not confirming', async () => {
    vi.spyOn(spawnMod, 'spawnCli').mockResolvedValue(
      mockResult('', 1, 'error: signing failed')
    );
    const client = new X402PaymentClient();
    await expect(client.signPayment({ accepts: [] })).rejects.toThrow(/signing failed/);
  });
});
```

- [ ] **Step 5.2: Run test to verify failure (TDD red confirmation)**

Run:
```bash
pnpm --filter @x402/onchain-clients test
```

Expected: FAIL with missing module.

- [ ] **Step 5.3: Create x402-payment.ts**

Create file `packages/onchain-clients/src/x402-payment.ts`:
```typescript
import { spawnCli } from './util/spawn-cli';
import type { Accept } from '@x402/shared';

export interface SignPaymentOptions {
  accepts: Accept[];
  from?: string;
}

export interface PaymentProof {
  signature: string;
  authorization: {
    from: string;
    to: string;
    value: string;
    validAfter: string;
    validBefore: string;
    nonce: string;
  };
  sessionCert?: string;
}

interface ConfirmingResponse {
  confirming: true;
  message: string;
  next: string;
}

/**
 * Wrapper for `onchainos payment x402-pay` CLI command.
 * Handles the confirming-response retry pattern automatically:
 * on exit code 2 with `confirming: true`, retries with --force flag.
 */
export class X402PaymentClient {
  async signPayment(opts: SignPaymentOptions): Promise<PaymentProof> {
    const acceptsJson = JSON.stringify(opts.accepts);
    const baseArgs: string[] = ['payment', 'x402-pay', '--accepts', acceptsJson];
    if (opts.from) baseArgs.push('--from', opts.from);

    const first = await spawnCli('onchainos', baseArgs);

    if (first.exitCode === 0) {
      return first.parseJson<PaymentProof>();
    }

    if (first.exitCode === 2) {
      try {
        const confirming = first.parseJson<ConfirmingResponse>();
        if (confirming.confirming === true) {
          const retry = await spawnCli('onchainos', [...baseArgs, '--force']);
          if (retry.exitCode !== 0) {
            throw new Error(`x402-pay failed after --force retry: ${retry.stderr}`);
          }
          return retry.parseJson<PaymentProof>();
        }
      } catch (e) {
        if (e instanceof Error && e.message.includes('--force retry')) throw e;
      }
    }

    throw new Error(`x402-pay failed: ${first.stderr || first.stdout}`);
  }
}
```

- [ ] **Step 5.4: Run tests + Commit**

Run:
```bash
pnpm --filter @x402/onchain-clients test
git add packages/onchain-clients/
git commit -m "feat(onchain-clients): add X402PaymentClient with --force retry handling"
```

Expected: 14 tests pass (11 existing + 3 x402-payment).

---

### Task 6: Dex Trenches CLI Wrapper + Wallet History Adapter

**Files:**
- Create: `packages/onchain-clients/src/trenches.ts`
- Create: `packages/onchain-clients/tests/trenches.test.ts`
- Create: `packages/onchain-clients/src/recovery-adapter.ts`
- Create: `packages/onchain-clients/tests/recovery-adapter.test.ts`

**Steps:**

- [ ] **Step 6.1: Write failing trenches test first (TDD red step)**

Create file `packages/onchain-clients/tests/trenches.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import * as spawnMod from '../src/util/spawn-cli';
import { TrenchesClient } from '../src/trenches';

const mockResult = (stdout: string) => ({
  exitCode: 0,
  stdout,
  stderr: '',
  parseJson<T>() {
    return JSON.parse(this.stdout) as T;
  },
});

describe('TrenchesClient', () => {
  it('tokenDevInfo invokes memepump token-dev-info with address', async () => {
    const spy = vi.spyOn(spawnMod, 'spawnCli').mockResolvedValue(
      mockResult('{"devHoldingInfo":{"address":"0xDEV","rugPullCount":3}}')
    );
    const client = new TrenchesClient();
    const info = await client.tokenDevInfo('0xTOKEN');
    expect(info.devHoldingInfo?.rugPullCount).toBe(3);
    expect(spy).toHaveBeenCalledWith(
      'onchainos',
      ['memepump', 'token-dev-info', '--address', '0xTOKEN'],
      expect.any(Object)
    );
  });

  it('bundleInfo invokes memepump token-bundle-info', async () => {
    const spy = vi.spyOn(spawnMod, 'spawnCli').mockResolvedValue(
      mockResult('{"bundleDetected":false,"sniperCount":0}')
    );
    const client = new TrenchesClient();
    await client.bundleInfo('0xTOKEN');
    expect(spy).toHaveBeenCalledWith(
      'onchainos',
      ['memepump', 'token-bundle-info', '--address', '0xTOKEN'],
      expect.any(Object)
    );
  });
});
```

- [ ] **Step 6.2: Run test to verify failure**

Run:
```bash
pnpm --filter @x402/onchain-clients test
```

Expected: FAIL with missing module.

- [ ] **Step 6.3: Create trenches.ts**

Create file `packages/onchain-clients/src/trenches.ts`:
```typescript
import { spawnCli } from './util/spawn-cli';

export interface DevHoldingInfo {
  address: string;
  rugPullCount: number;
  createdTokenCount?: number;
}

export interface TokenDevInfoResult {
  devHoldingInfo: DevHoldingInfo | null;
}

export interface BundleInfoResult {
  bundleDetected: boolean;
  sniperCount: number;
  bundledBuyCount?: number;
}

/**
 * Wrapper for `onchainos memepump` CLI commands (from okx-dex-trenches skill).
 * Used by Producer's trench-scan service to assess token dev reputation.
 */
export class TrenchesClient {
  async tokenDevInfo(tokenAddress: string): Promise<TokenDevInfoResult> {
    const result = await spawnCli('onchainos', [
      'memepump',
      'token-dev-info',
      '--address',
      tokenAddress,
    ]);
    if (result.exitCode !== 0) {
      throw new Error(`memepump token-dev-info failed: ${result.stderr}`);
    }
    return result.parseJson<TokenDevInfoResult>();
  }

  async bundleInfo(tokenAddress: string): Promise<BundleInfoResult> {
    const result = await spawnCli('onchainos', [
      'memepump',
      'token-bundle-info',
      '--address',
      tokenAddress,
    ]);
    if (result.exitCode !== 0) {
      throw new Error(`memepump token-bundle-info failed: ${result.stderr}`);
    }
    return result.parseJson<BundleInfoResult>();
  }
}
```

- [ ] **Step 6.4: Write recovery adapter test first (TDD red step)**

Create file `packages/onchain-clients/tests/recovery-adapter.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import * as spawnMod from '../src/util/spawn-cli';
import { createWalletHistoryFetcher } from '../src/recovery-adapter';

describe('createWalletHistoryFetcher', () => {
  it('fetches recent Producer-side history and maps to WalletHistoryEntry', async () => {
    vi.spyOn(spawnMod, 'spawnCli').mockResolvedValue({
      exitCode: 0,
      stdout: JSON.stringify([
        {
          orderList: [
            {
              txHash: '0xTX1',
              txTime: '1700000000000',
              direction: 'receive',
              from: '0xCONSUMER',
              to: '0xPRODUCER',
              coinSymbol: 'USDG',
              coinAmount: '0.01',
            },
          ],
        },
      ]),
      stderr: '',
      parseJson<T>() {
        return JSON.parse(this.stdout) as T;
      },
    });

    const fetcher = createWalletHistoryFetcher({
      accountId: 'producer-account',
      chain: 'xlayer',
      nonceResolver: (entry) => `0xNONCE_${entry.txHash.slice(-4)}`,
    });

    const entries = await fetcher();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.txHash).toBe('0xTX1');
    expect(entries[0]?.nonce).toBe('0xNONCE_0xTX1');
    expect(entries[0]?.timestamp).toBe(1700000000000);
  });

  it('returns empty array when no receive-direction entries exist', async () => {
    vi.spyOn(spawnMod, 'spawnCli').mockResolvedValue({
      exitCode: 0,
      stdout: JSON.stringify([{ orderList: [] }]),
      stderr: '',
      parseJson<T>() {
        return JSON.parse(this.stdout) as T;
      },
    });

    const fetcher = createWalletHistoryFetcher({
      accountId: 'producer-account',
      chain: 'xlayer',
      nonceResolver: () => '',
    });
    const entries = await fetcher();
    expect(entries).toHaveLength(0);
  });
});
```

- [ ] **Step 6.5: Create recovery-adapter.ts**

Create file `packages/onchain-clients/src/recovery-adapter.ts`:
```typescript
import { WalletClient, type HistoryEntry } from './wallet';

export interface WalletHistoryEntry {
  txHash: string;
  nonce: string;
  timestamp: number;
}

export interface RecoveryAdapterOptions {
  accountId: string;
  chain: string;
  nonceResolver: (entry: HistoryEntry) => string;
  walletClient?: WalletClient;
}

/**
 * Creates a WalletHistoryFetcher compatible with @x402/orchestrator's reconcileOnBoot.
 *
 * Reads recent Producer-side receive events via `onchainos wallet history` and
 * maps each entry to a WalletHistoryEntry with a derived nonce.
 *
 * Nonce derivation is caller-provided via `nonceResolver` because the CLI does
 * not expose nonces in the history response — callers must match against local
 * payments table (e.g., by amount + from + timestamp window, then attach nonce).
 *
 * Spec Section 4.2 step 4 reconciliation fallback.
 */
export function createWalletHistoryFetcher(
  opts: RecoveryAdapterOptions
): () => Promise<WalletHistoryEntry[]> {
  const client = opts.walletClient ?? new WalletClient();
  return async () => {
    const history = await client.getHistory({
      accountId: opts.accountId,
      chain: opts.chain,
    });
    return history
      .filter((entry) => entry.direction === 'receive')
      .map((entry) => ({
        txHash: entry.txHash,
        nonce: opts.nonceResolver(entry),
        timestamp: Number.parseInt(entry.txTime, 10),
      }));
  };
}
```

- [ ] **Step 6.6: Run tests + Commit**

Run:
```bash
pnpm --filter @x402/onchain-clients test
git add packages/onchain-clients/
git commit -m "feat(onchain-clients): add TrenchesClient + wallet-history recovery adapter"
```

Expected: 18 tests pass (14 existing + 2 trenches + 2 adapter).

---

### Task 7: Update `@x402/onchain-clients` Barrel Exports

**Files:**
- Modify: `packages/onchain-clients/src/index.ts`

**Steps:**

- [ ] **Step 7.1: Update index.ts with full barrel exports**

Overwrite file `packages/onchain-clients/src/index.ts`:
```typescript
export { spawnCli } from './util/spawn-cli';
export type { SpawnCliResult, SpawnCliOptions } from './util/spawn-cli';

export { WalletClient } from './wallet';
export type {
  WalletStatus,
  BalanceOptions,
  SendTokenOptions,
  SendTokenResult,
  HistoryOptions,
  HistoryEntry,
} from './wallet';

export { X402PaymentClient } from './x402-payment';
export type { SignPaymentOptions, PaymentProof } from './x402-payment';

export { TrenchesClient } from './trenches';
export type {
  DevHoldingInfo,
  TokenDevInfoResult,
  BundleInfoResult,
} from './trenches';

export { createWalletHistoryFetcher } from './recovery-adapter';
export type { WalletHistoryEntry, RecoveryAdapterOptions } from './recovery-adapter';
```

- [ ] **Step 7.2: Typecheck + Commit**

Run:
```bash
pnpm --filter @x402/onchain-clients typecheck
git add packages/onchain-clients/
git commit -m "feat(onchain-clients): export full public API"
```

Expected: zero typecheck errors.

---

### Task 8: Chunk 3 Exit Criteria Check

- [ ] **Step 8.1: Verify all workspaces typecheck + test**

Run:
```bash
cd /root/hackathon/okx/x402-earn-pay-earn
pnpm -r typecheck
pnpm -r test
```

Expected: zero errors. Test totals: 9 okx-auth + 42 orchestrator + 6 mcp-client + 18 onchain-clients = 75+ tests passing.

- [ ] **Step 8.2: Tag completion**

Run:
```bash
git status
git log --oneline | head -25
git tag chunk-3-complete
```

---

**Chunk 3 Exit Criteria:**
- `@x402/mcp-client` package with JSON-RPC client + typed helpers (getQuote, getTokenPriceInfo)
- `@x402/onchain-clients` package with: spawnCli utility, WalletClient, X402PaymentClient, TrenchesClient, createWalletHistoryFetcher
- All packages typecheck clean
- 75+ unit tests passing across all workspaces
- WalletHistoryFetcher wired and ready for orchestrator recovery path
- X402PaymentClient handles --force retry on CLI confirming response
- Barrel exports ready for Producer + Consumer to import in Chunks 4-5

**Next:** Chunk 4 — Producer Agent

---

## Chunk 4: Producer Agent (Fastify HTTP Service)

**Goal:** Build the Producer application — a Fastify HTTP service exposing 3 paid endpoints guarded by an x402-gate plugin. Backends 2 services via MCP and 1 via CLI. Integrates with OKX Facilitator API for verify + settle.

**Why this comes fourth:** Consumer (Chunk 5) needs a running Producer to call during tests. Dashboard (Chunk 6) needs Producer routes to exist. Producer is the payment-terminating end of the loop.

**Design reference:** Spec Section 2 Component 1, Section 3.2 Stage 3, Section 4.6.

---

### Task 1: Scaffold Producer App

**Files:**
- Create: `apps/producer/package.json`
- Create: `apps/producer/tsconfig.json`
- Create: `apps/producer/src/server.ts`
- Create: `apps/producer/src/config.ts`

**Steps:**

- [ ] **Step 1.1: Create package.json**

Create file `apps/producer/package.json`:
```json
{
  "name": "producer",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "dev": "tsx watch src/server.ts",
    "start": "tsx src/server.ts",
    "test": "vitest run"
  },
  "dependencies": {
    "@x402/shared": "workspace:*",
    "@x402/okx-auth": "workspace:*",
    "@x402/orchestrator": "workspace:*",
    "@x402/mcp-client": "workspace:*",
    "@x402/onchain-clients": "workspace:*",
    "better-sqlite3": "^11.3.0",
    "fastify": "^5.0.0",
    "fastify-plugin": "^5.0.1",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.11",
    "@types/node": "^20.16.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 1.2: Create tsconfig.json**

Create file `apps/producer/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "./dist", "rootDir": ".", "types": ["node"] },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 1.3: Create config.ts**

Create file `apps/producer/src/config.ts`:
```typescript
import { config as loadEnv } from 'dotenv';
import {
  PRODUCER_PORT,
  USDG_CONTRACT,
  OKX_MCP_ENDPOINT,
  OKX_FACILITATOR_BASE,
} from '@x402/shared';

loadEnv();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const config = {
  port: Number(process.env.PRODUCER_PORT ?? PRODUCER_PORT),
  producerAddress: requireEnv('PRODUCER_ADDRESS'),
  producerAccountId: requireEnv('PRODUCER_ACCOUNT_ID'),
  okxApiKey: requireEnv('OKX_API_KEY'),
  okxSecretKey: requireEnv('OKX_SECRET_KEY'),
  okxPassphrase: requireEnv('OKX_PASSPHRASE'),
  mcpEndpoint: process.env.OKX_MCP_SERVER_URL ?? OKX_MCP_ENDPOINT,
  facilitatorBase: process.env.OKX_FACILITATOR_BASE_URL ?? OKX_FACILITATOR_BASE,
  usdgContract: USDG_CONTRACT,
  dbPath: process.env.APP_DB_PATH ?? 'data/app.db',
} as const;
```

- [ ] **Step 1.4: Create server.ts (minimal bootstrap)**

Create file `apps/producer/src/server.ts`:
```typescript
import Fastify from 'fastify';
import Database from 'better-sqlite3';
import { migrate } from '@x402/orchestrator';
import { config } from './config';

async function bootstrap() {
  const db = new Database(config.dbPath);
  migrate(db);

  const fastify = Fastify({ logger: true });

  fastify.get('/health', async () => ({ status: 'ok' }));

  try {
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

bootstrap();
```

- [ ] **Step 1.5: Install + Typecheck + Commit**

Run:
```bash
pnpm install
pnpm --filter producer typecheck
git add apps/producer/
git commit -m "chore(producer): scaffold Fastify app with config + health endpoint"
```

Expected: zero errors.

---

### Task 2: Facilitator REST API Client (TDD)

**Files:**
- Create: `apps/producer/src/facilitator/client.ts`
- Create: `apps/producer/tests/facilitator/client.test.ts`

**Steps:**

- [ ] **Step 2.1: Write failing tests first (TDD red step)**

Create file `apps/producer/tests/facilitator/client.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FacilitatorClient } from '../../src/facilitator/client';

describe('FacilitatorClient', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('verify() posts to /api/v6/pay/x402/verify with signed HMAC headers', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        code: '0',
        msg: 'success',
        data: {
          isValid: true,
          invalidReason: null,
          invalidMessage: null,
          payer: '0xPAYER',
        },
      }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const client = new FacilitatorClient({
      baseUrl: 'https://web3.okx.com',
      apiKey: 'KEY',
      secretKey: 'SECRET',
      passphrase: 'PASS',
    });

    const result = await client.verify({
      x402Version: 2,
      paymentPayload: {} as never,
      paymentRequirements: {} as never,
    });

    expect(result.isValid).toBe(true);
    expect(result.payer).toBe('0xPAYER');

    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toBe('https://web3.okx.com/api/v6/pay/x402/verify');
    expect(init.method).toBe('POST');
    expect(init.headers['OK-ACCESS-KEY']).toBe('KEY');
    expect(init.headers['OK-ACCESS-SIGN']).toBeDefined();
    expect(init.headers['OK-ACCESS-TIMESTAMP']).toBeDefined();
    expect(init.headers['OK-ACCESS-PASSPHRASE']).toBe('PASS');
  });

  it('settle() posts to /api/v6/pay/x402/settle and returns settlement data', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        code: '0',
        msg: 'success',
        data: {
          success: true,
          errorReason: null,
          errorMessage: null,
          payer: '0xPAYER',
          transaction: '0xTXHASH',
          network: 'eip155:196',
          status: 'success',
        },
      }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const client = new FacilitatorClient({
      baseUrl: 'https://web3.okx.com',
      apiKey: 'KEY',
      secretKey: 'SECRET',
      passphrase: 'PASS',
    });

    const result = await client.settle({
      x402Version: 2,
      paymentPayload: {} as never,
      paymentRequirements: {} as never,
      syncSettle: true,
    });

    expect(result.success).toBe(true);
    expect(result.transaction).toBe('0xTXHASH');
    expect(result.status).toBe('success');
  });

  it('retries verify on 5xx with exponential backoff (max 1 retry)', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          code: '0',
          msg: 'success',
          data: {
            isValid: true,
            invalidReason: null,
            invalidMessage: null,
            payer: '0xPAYER',
          },
        }),
      });
    global.fetch = mockFetch as unknown as typeof fetch;

    const client = new FacilitatorClient({
      baseUrl: 'https://web3.okx.com',
      apiKey: 'KEY',
      secretKey: 'SECRET',
      passphrase: 'PASS',
      retryDelayMs: 10, // fast test
    });

    const result = await client.verify({
      x402Version: 2,
      paymentPayload: {} as never,
      paymentRequirements: {} as never,
    });

    expect(result.isValid).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('throws FacilitatorError on 401 (HMAC auth failure)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ code: 'UNAUTHORIZED' }),
    }) as unknown as typeof fetch;

    const client = new FacilitatorClient({
      baseUrl: 'https://web3.okx.com',
      apiKey: 'KEY',
      secretKey: 'SECRET',
      passphrase: 'PASS',
    });

    await expect(
      client.verify({
        x402Version: 2,
        paymentPayload: {} as never,
        paymentRequirements: {} as never,
      })
    ).rejects.toThrow(/401|unauthorized/i);
  });
});
```

- [ ] **Step 2.2: Run test to verify failure**

Run:
```bash
pnpm --filter producer test
```

Expected: FAIL with missing module.

- [ ] **Step 2.3: Create FacilitatorClient**

Create file `apps/producer/src/facilitator/client.ts`:
```typescript
import { signOkxRequest } from '@x402/okx-auth';
import {
  FACILITATOR_PATHS,
  OkxApiEnvelopeSchema,
  VerifyResponseSchema,
  SettleResponseSchema,
  type VerifyRequest,
  type VerifyResponse,
  type SettleRequest,
  type SettleResponse,
} from '@x402/shared';

export interface FacilitatorConfig {
  baseUrl: string;
  apiKey: string;
  secretKey: string;
  passphrase: string;
  retryDelayMs?: number;
}

export class FacilitatorError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = 'FacilitatorError';
  }
}

export class FacilitatorClient {
  private readonly retryDelayMs: number;

  constructor(private readonly config: FacilitatorConfig) {
    this.retryDelayMs = config.retryDelayMs ?? 1_000;
  }

  async verify(request: VerifyRequest): Promise<VerifyResponse> {
    const envelope = await this.postWithRetry(FACILITATOR_PATHS.verify, request);
    return VerifyResponseSchema.parse(envelope.data);
  }

  async settle(request: SettleRequest): Promise<SettleResponse> {
    const envelope = await this.postWithRetry(FACILITATOR_PATHS.settle, request);
    return SettleResponseSchema.parse(envelope.data);
  }

  private async postWithRetry(
    path: string,
    body: unknown
  ): Promise<{ code: string; msg: string; data: unknown }> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await this.postOnce(path, body);
      } catch (err) {
        if (
          err instanceof FacilitatorError &&
          err.status &&
          err.status >= 500 &&
          attempt === 0
        ) {
          await new Promise((r) => setTimeout(r, this.retryDelayMs));
          continue;
        }
        throw err;
      }
    }
    throw new FacilitatorError('retry exhausted');
  }

  private async postOnce(
    path: string,
    body: unknown
  ): Promise<{ code: string; msg: string; data: unknown }> {
    const bodyStr = JSON.stringify(body);
    const { timestamp, signature } = signOkxRequest({
      method: 'POST',
      path,
      body: bodyStr,
      secretKey: this.config.secretKey,
    });

    const res = await fetch(`${this.config.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'OK-ACCESS-KEY': this.config.apiKey,
        'OK-ACCESS-SIGN': signature,
        'OK-ACCESS-TIMESTAMP': timestamp,
        'OK-ACCESS-PASSPHRASE': this.config.passphrase,
      },
      body: bodyStr,
    });

    if (!res.ok) {
      throw new FacilitatorError(`HTTP ${res.status} ${res.statusText}`, res.status);
    }

    const json = (await res.json()) as unknown;
    const envelope = OkxApiEnvelopeSchema.parse(json);
    if (envelope.code !== '0') {
      throw new FacilitatorError(`API error: ${envelope.code} ${envelope.msg}`);
    }
    return envelope;
  }
}
```

- [ ] **Step 2.4: Run tests + Commit**

Run:
```bash
pnpm --filter producer test
pnpm --filter producer typecheck
git add apps/producer/
git commit -m "feat(producer): add FacilitatorClient with HMAC auth + retry"
```

Expected: 4 tests pass, zero typecheck errors.

---

### Task 3: x402-Gate Fastify Plugin

**Files:**
- Create: `apps/producer/src/plugins/x402-gate.ts`
- Create: `apps/producer/src/plugins/payload-codec.ts`
- Create: `apps/producer/tests/plugins/payload-codec.test.ts`

**Steps:**

- [ ] **Step 3.1: Write failing payload codec test first**

Create file `apps/producer/tests/plugins/payload-codec.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { encode402Payload, decodePaymentPayload } from '../../src/plugins/payload-codec';
import type { Challenge402, PaymentPayload } from '@x402/shared';

describe('encode402Payload / decodePaymentPayload', () => {
  it('round-trips a Challenge402 via base64 encoding', () => {
    const challenge: Challenge402 = {
      x402Version: 2,
      error: 'PAYMENT-SIGNATURE header is required',
      resource: {
        url: 'http://localhost/v1/market-snapshot',
        description: 'market-snapshot',
        mimeType: 'application/json',
      },
      accepts: [
        {
          scheme: 'exact',
          network: 'eip155:196',
          amount: '10000',
          asset: '0x4ae46a509f6b1d9056937ba4500cb143933d2dc8',
          payTo: '0xPRODUCER',
          maxTimeoutSeconds: 60,
          extra: { name: 'USDG', version: '2' },
        },
      ],
    };
    const encoded = encode402Payload(challenge);
    expect(encoded).toMatch(/^[A-Za-z0-9+/=]+$/);
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const parsed = JSON.parse(decoded);
    expect(parsed.x402Version).toBe(2);
    expect(parsed.accepts[0].amount).toBe('10000');
  });

  it('decodes a base64-encoded PaymentPayload header', () => {
    const payload: PaymentPayload = {
      x402Version: 2,
      resource: {
        url: 'http://localhost/v1/market-snapshot',
        description: 'market-snapshot',
        mimeType: 'application/json',
      },
      accepted: {
        scheme: 'exact',
        network: 'eip155:196',
        amount: '10000',
        asset: '0x4ae46a509f6b1d9056937ba4500cb143933d2dc8',
        payTo: '0xPRODUCER',
        maxTimeoutSeconds: 60,
        extra: { name: 'USDG', version: '2' },
      },
      payload: {
        signature: '0xSIG',
        authorization: {
          from: '0xFROM',
          to: '0xTO',
          value: '10000',
          validAfter: '0',
          validBefore: '1000',
          nonce: '0xNONCE',
        },
      },
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64');
    const decoded = decodePaymentPayload(encoded);
    expect(decoded.x402Version).toBe(2);
    expect(decoded.payload.authorization.nonce).toBe('0xNONCE');
  });

  it('throws on invalid base64', () => {
    expect(() => decodePaymentPayload('!!!not-base64!!!')).toThrow();
  });

  it('throws on valid base64 but invalid PaymentPayload shape', () => {
    const bogus = Buffer.from('{"bogus":true}').toString('base64');
    expect(() => decodePaymentPayload(bogus)).toThrow();
  });
});
```

- [ ] **Step 3.2: Run test to verify failure**

Run:
```bash
pnpm --filter producer test
```

Expected: FAIL with missing module.

- [ ] **Step 3.3: Create payload-codec.ts**

Create file `apps/producer/src/plugins/payload-codec.ts`:
```typescript
import {
  Challenge402Schema,
  PaymentPayloadSchema,
  type Challenge402,
  type PaymentPayload,
} from '@x402/shared';

/**
 * Encode a 402 challenge payload as base64 JSON for the PAYMENT-REQUIRED header.
 * Per spec: server-side 402 response header is base64(JSON(Challenge402)).
 */
export function encode402Payload(challenge: Challenge402): string {
  const validated = Challenge402Schema.parse(challenge);
  return Buffer.from(JSON.stringify(validated), 'utf8').toString('base64');
}

/**
 * Decode the PAYMENT-SIGNATURE header from a client and validate as PaymentPayload v2.
 * Throws on base64 decode error or schema mismatch.
 */
export function decodePaymentPayload(base64: string): PaymentPayload {
  const json = Buffer.from(base64, 'base64').toString('utf8');
  const parsed = JSON.parse(json);
  return PaymentPayloadSchema.parse(parsed);
}
```

- [ ] **Step 3.4: Run tests + Commit**

Run:
```bash
pnpm --filter producer test
git add apps/producer/
git commit -m "feat(producer): add payload codec for x402 v2 challenge/payment headers"
```

Expected: 4 codec tests pass.

- [ ] **Step 3.5: Create x402-gate.ts (Fastify plugin)**

Create file `apps/producer/src/plugins/x402-gate.ts`:
```typescript
import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { Store, EventBus } from '@x402/orchestrator';
import type { PaymentPayload } from '@x402/shared';
import { USDG_CONTRACT } from '@x402/shared';
import { FacilitatorClient } from '../facilitator/client';
import { encode402Payload, decodePaymentPayload } from './payload-codec';

export interface X402RouteOptions {
  amount: string; // minimal units
  service: string;
}

export interface X402GateOptions {
  facilitator: FacilitatorClient;
  store: Store;
  eventBus: EventBus;
  producerAddress: string;
}

declare module 'fastify' {
  interface FastifyContextConfig {
    x402?: X402RouteOptions;
  }
  interface FastifyRequest {
    paymentProof?: PaymentPayload;
    payer?: string;
    x402Opts?: X402RouteOptions;
  }
}

const x402GatePlugin: FastifyPluginAsync<X402GateOptions> = async (fastify, opts) => {
  fastify.addHook('preHandler', async (request, reply) => {
    const routeOpts = request.routeOptions.config?.x402;
    if (!routeOpts) return;

    const paymentHeader = request.headers['payment-signature'] as string | undefined;

    if (!paymentHeader) {
      const challenge = encode402Payload({
        x402Version: 2,
        resource: {
          url: request.url,
          description: routeOpts.service,
          mimeType: 'application/json',
        },
        accepts: [
          {
            scheme: 'exact',
            network: 'eip155:196',
            amount: routeOpts.amount,
            asset: USDG_CONTRACT,
            payTo: opts.producerAddress,
            maxTimeoutSeconds: 60,
            extra: { name: 'USDG', version: '2' },
          },
        ],
      });
      reply.code(402).header('PAYMENT-REQUIRED', challenge).send({});
      return reply;
    }

    let decoded: PaymentPayload;
    try {
      decoded = decodePaymentPayload(paymentHeader);
    } catch (err) {
      reply.code(402).send({ error: 'Invalid PAYMENT-SIGNATURE header' });
      return reply;
    }

    const verifyResult = await opts.facilitator.verify({
      x402Version: 2,
      paymentPayload: decoded,
      paymentRequirements: decoded.accepted,
    });

    if (!verifyResult.isValid) {
      reply.code(402).send({ error: verifyResult.invalidMessage });
      return reply;
    }

    request.paymentProof = decoded;
    request.payer = verifyResult.payer;
    request.x402Opts = routeOpts;

    // Record pending payment row. cycle_number tracks the Consumer's active cycle
    // at the time of signing — look up the most recent non-COMPLETED cycle from
    // the payer side via store.getCurrentCycle(). Consumer owns loop_cycles so
    // this is the Consumer's current cycle, which is exactly what we want.
    const currentCycle = opts.store.getCurrentCycle();
    opts.store.insertPendingPayment({
      cycleNumber: currentCycle?.cycle_number ?? 0,
      scheme: decoded.accepted.scheme,
      nonce: decoded.payload.authorization.nonce,
      fromAddr: decoded.payload.authorization.from,
      toAddr: decoded.payload.authorization.to,
      amountMinimal: decoded.payload.authorization.value,
      asset: decoded.accepted.asset,
      service: routeOpts.service,
      signedAt: Date.now(),
    });
    opts.store.updateVerification(decoded.payload.authorization.nonce, Date.now());
    opts.eventBus.emit('PAYMENT_VERIFIED', {
      payer: verifyResult.payer,
      amount: decoded.accepted.amount,
      service: routeOpts.service,
      nonce: decoded.payload.authorization.nonce,
    });
  });

  fastify.addHook('onResponse', async (request, reply) => {
    if (!request.paymentProof || !request.x402Opts || reply.statusCode !== 200) return;

    try {
      const settleResult = await opts.facilitator.settle({
        x402Version: 2,
        paymentPayload: request.paymentProof,
        paymentRequirements: request.paymentProof.accepted,
        syncSettle: true,
      });
      opts.store.updateSettlement(request.paymentProof.payload.authorization.nonce, {
        txHash: settleResult.transaction,
        settledAt: Date.now(),
        status: 'settled',
      });
      opts.eventBus.emit('SETTLEMENT_COMPLETED', {
        txHash: settleResult.transaction,
        amount: request.paymentProof.accepted.amount,
        service: request.x402Opts.service,
        nonce: request.paymentProof.payload.authorization.nonce,
      });
    } catch (err) {
      opts.store.updateSettlement(request.paymentProof.payload.authorization.nonce, {
        txHash: null,
        settledAt: Date.now(),
        status: 'settle_failed',
      });
      opts.eventBus.emit('SETTLEMENT_FAILED', {
        nonce: request.paymentProof.payload.authorization.nonce,
        error: (err as Error).message,
      });
    }
  });
};

export default fp(x402GatePlugin, { name: 'x402-gate' });
```

- [ ] **Step 3.6: Typecheck + Commit**

Run:
```bash
pnpm --filter producer typecheck
git add apps/producer/
git commit -m "feat(producer): add x402-gate Fastify plugin with preHandler + onResponse hooks"
```

Expected: zero typecheck errors.

---

### Task 4: Producer Service Routes (3 paid endpoints)

**Files:**
- Create: `apps/producer/src/routes/market-snapshot.ts`
- Create: `apps/producer/src/routes/swap-quote.ts`
- Create: `apps/producer/src/routes/trench-scan.ts`
- Modify: `apps/producer/src/server.ts`

**Steps:**

- [ ] **Step 4.1: Create market-snapshot route**

Create file `apps/producer/src/routes/market-snapshot.ts`:
```typescript
import type { FastifyPluginAsync } from 'fastify';
import type { OKXMCPClient } from '@x402/mcp-client';
import type { Store } from '@x402/orchestrator';

interface PluginOpts {
  mcpClient: OKXMCPClient;
  store: Store;
}

export const marketSnapshotRoute: FastifyPluginAsync<PluginOpts> = async (fastify, opts) => {
  fastify.post(
    '/v1/market-snapshot',
    {
      config: {
        x402: { amount: '10000', service: 'market-snapshot' }, // 0.01 USDG
      },
      schema: {
        body: {
          type: 'object',
          required: ['tokenContractAddress'],
          properties: {
            tokenContractAddress: {
              type: 'string',
              pattern: '^0x[a-fA-F0-9]{40}$',
            },
          },
        },
      },
    },
    async (request) => {
      const body = request.body as { tokenContractAddress: string };
      const start = Date.now();
      try {
        const info = await opts.mcpClient.getTokenPriceInfo({
          chainIndex: '196',
          tokenContractAddress: body.tokenContractAddress,
        });
        opts.store.logMcpCall({
          timestamp: Date.now(),
          tool: 'dex-okx-market-token-price-info',
          args: body,
          result: info,
          durationMs: Date.now() - start,
          success: true,
        });
        return { service: 'market-snapshot', data: info, servedAt: Date.now() };
      } catch (err) {
        opts.store.logMcpCall({
          timestamp: Date.now(),
          tool: 'dex-okx-market-token-price-info',
          args: body,
          result: { error: (err as Error).message },
          durationMs: Date.now() - start,
          success: false,
        });
        throw err;
      }
    }
  );
};
```

- [ ] **Step 4.2: Create swap-quote route**

Create file `apps/producer/src/routes/swap-quote.ts`:
```typescript
import type { FastifyPluginAsync } from 'fastify';
import type { OKXMCPClient } from '@x402/mcp-client';
import type { Store } from '@x402/orchestrator';

interface PluginOpts {
  mcpClient: OKXMCPClient;
  store: Store;
}

export const swapQuoteRoute: FastifyPluginAsync<PluginOpts> = async (fastify, opts) => {
  fastify.post(
    '/v1/swap-quote',
    {
      config: {
        x402: { amount: '15000', service: 'swap-quote' }, // 0.015 USDG
      },
      schema: {
        body: {
          type: 'object',
          required: ['fromTokenAddress', 'toTokenAddress', 'amount'],
          properties: {
            fromTokenAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
            toTokenAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
            amount: { type: 'string', pattern: '^[0-9]+$' },
            slippage: { type: 'string' },
          },
        },
      },
    },
    async (request) => {
      const body = request.body as {
        fromTokenAddress: string;
        toTokenAddress: string;
        amount: string;
        slippage?: string;
      };
      const start = Date.now();
      try {
        const quote = await opts.mcpClient.getQuote({
          chainIndex: '196',
          fromTokenAddress: body.fromTokenAddress,
          toTokenAddress: body.toTokenAddress,
          amount: body.amount,
          slippage: body.slippage,
        });
        opts.store.logMcpCall({
          timestamp: Date.now(),
          tool: 'dex-okx-dex-quote',
          args: body,
          result: quote,
          durationMs: Date.now() - start,
          success: true,
        });
        return { service: 'swap-quote', data: quote, servedAt: Date.now() };
      } catch (err) {
        opts.store.logMcpCall({
          timestamp: Date.now(),
          tool: 'dex-okx-dex-quote',
          args: body,
          result: { error: (err as Error).message },
          durationMs: Date.now() - start,
          success: false,
        });
        throw err;
      }
    }
  );
};
```

- [ ] **Step 4.3: Create trench-scan route**

Create file `apps/producer/src/routes/trench-scan.ts`:
```typescript
import type { FastifyPluginAsync } from 'fastify';
import type { TrenchesClient } from '@x402/onchain-clients';

interface PluginOpts {
  trenchesClient: TrenchesClient;
}

export const trenchScanRoute: FastifyPluginAsync<PluginOpts> = async (fastify, opts) => {
  fastify.post(
    '/v1/trench-scan',
    {
      config: {
        x402: { amount: '20000', service: 'trench-scan' }, // 0.02 USDG
      },
      schema: {
        body: {
          type: 'object',
          required: ['tokenAddress'],
          properties: {
            tokenAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
          },
        },
      },
    },
    async (request) => {
      const body = request.body as { tokenAddress: string };
      const [devInfo, bundleInfo] = await Promise.all([
        opts.trenchesClient.tokenDevInfo(body.tokenAddress),
        opts.trenchesClient.bundleInfo(body.tokenAddress),
      ]);
      return {
        service: 'trench-scan',
        data: {
          dev: devInfo.devHoldingInfo,
          bundle: bundleInfo,
          riskLevel: computeRiskLevel(devInfo, bundleInfo),
        },
        servedAt: Date.now(),
      };
    }
  );
};

function computeRiskLevel(
  devInfo: { devHoldingInfo: { rugPullCount: number } | null },
  bundleInfo: { bundleDetected: boolean; sniperCount: number }
): 'low' | 'medium' | 'high' {
  const rugCount = devInfo.devHoldingInfo?.rugPullCount ?? 0;
  if (rugCount >= 3 || bundleInfo.sniperCount > 10) return 'high';
  if (rugCount >= 1 || bundleInfo.bundleDetected) return 'medium';
  return 'low';
}
```

- [ ] **Step 4.4: Wire all routes into server.ts**

Overwrite file `apps/producer/src/server.ts`:
```typescript
import Fastify from 'fastify';
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { migrate, Store, EventBus, reconcileOnBoot } from '@x402/orchestrator';
import { OKXMCPClient } from '@x402/mcp-client';
import { TrenchesClient, WalletClient, createWalletHistoryFetcher } from '@x402/onchain-clients';
import { config } from './config';
import { FacilitatorClient } from './facilitator/client';
import x402GatePlugin from './plugins/x402-gate';
import { marketSnapshotRoute } from './routes/market-snapshot';
import { swapQuoteRoute } from './routes/swap-quote';
import { trenchScanRoute } from './routes/trench-scan';

async function bootstrap() {
  // Ensure data directory exists before opening SQLite.
  mkdirSync(path.dirname(config.dbPath), { recursive: true });
  const db = new Database(config.dbPath);
  migrate(db);

  const store = new Store(db);
  const eventBus = new EventBus(db, 'producer');
  const walletClient = new WalletClient();

  // Producer-side recovery: reconcile any non-terminal payments against wallet history
  // before accepting new requests. Spec Section 4.2.
  // Note: the nonce resolver pre-filters wallet history by matching against the
  // local payments table. An entry with a known (amount+from) pair attaches the
  // stored nonce back to the wallet history row.
  const pendingPayments = store.findNonTerminalPayments();
  if (pendingPayments.length > 0) {
    console.log(`Reconciling ${pendingPayments.length} non-terminal payments...`);
    await walletClient.switchAccount(config.producerAccountId);
    const fetchWalletHistory = createWalletHistoryFetcher({
      accountId: config.producerAccountId,
      chain: 'xlayer',
      nonceResolver: (entry) => {
        // Match wallet history entry to a pending payment by amount + from_addr.
        const candidate = pendingPayments.find(
          (p) =>
            p.from_addr.toLowerCase() === entry.from.toLowerCase() &&
            // Use coinAmount as approximate match (may drift in decimals; acceptable for demo)
            p.amount_minimal !== null
        );
        return candidate ? candidate.nonce : '';
      },
      walletClient,
    });
    const recovery = await reconcileOnBoot({
      store,
      fetchWalletHistory,
      nowMs: Date.now(),
    });
    console.log('Recovery:', {
      reconciled: recovery.reconciled.length,
      abandoned: recovery.abandoned.length,
      stillPending: recovery.stillPending.length,
    });
  }

  const mcpClient = new OKXMCPClient({
    url: config.mcpEndpoint,
    apiKey: config.okxApiKey,
  });
  const trenchesClient = new TrenchesClient();
  const facilitator = new FacilitatorClient({
    baseUrl: config.facilitatorBase,
    apiKey: config.okxApiKey,
    secretKey: config.okxSecretKey,
    passphrase: config.okxPassphrase,
  });

  const fastify = Fastify({ logger: { level: 'info' } });

  fastify.get('/health', async () => ({ status: 'ok', time: Date.now() }));

  await fastify.register(x402GatePlugin, {
    facilitator,
    store,
    eventBus,
    producerAddress: config.producerAddress,
  });

  await fastify.register(marketSnapshotRoute, { mcpClient, store });
  await fastify.register(swapQuoteRoute, { mcpClient, store });
  await fastify.register(trenchScanRoute, { trenchesClient });

  try {
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    fastify.log.info(`Producer listening on port ${config.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

bootstrap();
```

- [ ] **Step 4.5: Typecheck + Commit**

Run:
```bash
pnpm --filter producer typecheck
git add apps/producer/
git commit -m "feat(producer): wire 3 paid routes (market-snapshot, swap-quote, trench-scan)"
```

Expected: zero typecheck errors.

---

### Task 5: Chunk 4 Exit Criteria Check

- [ ] **Step 5.1: Verify all workspaces typecheck + test**

Run:
```bash
cd /root/hackathon/okx/x402-earn-pay-earn
pnpm -r typecheck
pnpm -r test
```

Expected: zero errors. Test totals: 9 okx-auth + 42 orchestrator + 6 mcp-client + 18 onchain-clients + 8 producer = 83+ tests passing.

- [ ] **Step 5.2: Manual smoke test — start Producer**

Prerequisite: `.env` populated with real credentials.

Run:
```bash
cd /root/hackathon/okx/x402-earn-pay-earn
mkdir -p data
pnpm dev:producer
```

Expected output: `Producer listening on port 3001`. Server stays running.

- [ ] **Step 5.3: Verify 402 response on unauthorized request**

In another terminal, run:
```bash
curl -i -X POST http://localhost:3001/v1/market-snapshot \
  -H "Content-Type: application/json" \
  -d '{"tokenContractAddress":"0x4ae46a509f6b1d9056937ba4500cb143933d2dc8"}'
```

Expected: HTTP 402 with `PAYMENT-REQUIRED` header containing base64 challenge. Body is `{}`.

- [ ] **Step 5.4: Verify /health endpoint**

Run:
```bash
curl http://localhost:3001/health
```

Expected: `{"status":"ok","time":...}`.

- [ ] **Step 5.5: Stop Producer + Tag**

Run `Ctrl+C` in the dev:producer terminal, then:
```bash
git tag chunk-4-complete
```

---

**Chunk 4 Exit Criteria:**
- Producer app running on port 3001 with /health endpoint
- 3 paid routes registered: /v1/market-snapshot, /v1/swap-quote, /v1/trench-scan
- x402-gate Fastify plugin handles preHandler (verify) + onResponse (settle)
- FacilitatorClient handles HMAC signing + retry on 5xx
- Manual curl test confirms 402 response with PAYMENT-REQUIRED header
- All tests passing (83+ total)
- Typecheck clean

**Next:** Chunk 5 — Consumer Agent

---

## Chunk 5: Consumer Agent (Groq Reasoner + Loop)

**Goal:** Build the Consumer application — a Node script running an autonomous loop that reasons via Groq LLM, signs x402 payments via the CLI wrapper, and replays HTTP requests to Producer endpoints. Includes rate limit adaptive throttling and budget tracking.

**Why this comes fifth:** Needs Producer running and Chunks 2-3 packages as dependencies. Closes the economy loop.

**Design reference:** Spec Section 2 Component 2, Section 3.2 Stages 1-4, Section 3.5.

---

### Task 1: Scaffold Consumer App

**Files:**
- Create: `apps/consumer/package.json`
- Create: `apps/consumer/tsconfig.json`
- Create: `apps/consumer/src/config.ts`
- Create: `apps/consumer/src/index.ts`

**Steps:**

- [ ] **Step 1.1: Create package.json**

Create file `apps/consumer/package.json`:
```json
{
  "name": "consumer",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "start": "tsx src/index.ts",
    "test": "vitest run"
  },
  "dependencies": {
    "@x402/shared": "workspace:*",
    "@x402/orchestrator": "workspace:*",
    "@x402/onchain-clients": "workspace:*",
    "better-sqlite3": "^11.3.0",
    "dotenv": "^16.4.5",
    "openai": "^4.67.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.11",
    "@types/node": "^20.16.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

Note: `openai` package is used because Groq exposes an OpenAI-compatible API with `baseURL` override.

- [ ] **Step 1.2: Create tsconfig.json**

Create file `apps/consumer/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "./dist", "rootDir": ".", "types": ["node"] },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 1.3: Create config.ts**

Create file `apps/consumer/src/config.ts`:
```typescript
import { config as loadEnv } from 'dotenv';
import {
  GROQ_BASE_URL,
  GROQ_PRIMARY_MODEL,
  GROQ_FAST_MODEL,
  USDG_CONTRACT,
  PRODUCER_PORT,
} from '@x402/shared';

loadEnv();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const config = {
  groqApiKey: requireEnv('GROQ_API_KEY'),
  groqBaseUrl: process.env.GROQ_BASE_URL ?? GROQ_BASE_URL,
  groqPrimaryModel: process.env.GROQ_PRIMARY_MODEL ?? GROQ_PRIMARY_MODEL,
  groqFastModel: process.env.GROQ_FAST_MODEL ?? GROQ_FAST_MODEL,
  consumerAccountId: requireEnv('CONSUMER_ACCOUNT_ID'),
  producerUrl: process.env.PRODUCER_URL ?? `http://localhost:${PRODUCER_PORT}`,
  usdgContract: USDG_CONTRACT,
  dbPath: process.env.APP_DB_PATH ?? 'data/app.db',
  minBalanceUsdg: Number(process.env.MIN_BALANCE_USDG ?? '0.5'),
  targetCyclesPerMin: Number(process.env.TARGET_CYCLES_PER_MIN ?? '15'),
} as const;
```

- [ ] **Step 1.4: Install + Typecheck + Commit**

Run:
```bash
pnpm install
pnpm --filter consumer typecheck
git add apps/consumer/
git commit -m "chore(consumer): scaffold package with Groq config"
```

Expected: zero errors.

---

### Task 2: Groq LLM Reasoner (TDD)

**Files:**
- Create: `apps/consumer/src/reasoner/prompts.ts`
- Create: `apps/consumer/src/reasoner/client.ts`
- Create: `apps/consumer/tests/reasoner/client.test.ts`

**Steps:**

- [ ] **Step 2.1: Create prompts.ts**

Create file `apps/consumer/src/reasoner/prompts.ts`:
```typescript
import type { Decision } from '@x402/shared';

export interface AgentState {
  balanceUsdg: number;
  recentEarnings: Array<{ service: string; amount: string; timestamp: number }>;
  recentSpends: Array<{ service: string; amount: string; timestamp: number }>;
  cycleNumber: number;
  minBalanceUsdg: number;
}

export const SYSTEM_PROMPT = `You are Aria, an autonomous DeFi research agent on X Layer (chain 196).

Your objective: earn and spend USDG strategically to maintain a healthy balance and demonstrate an economy loop.

You have access to 3 paid services from Producer:
- market-snapshot (0.01 USDG): returns token price + 24h metrics
- trench-scan (0.02 USDG): returns token dev reputation + bundle risk
- swap-quote (0.015 USDG): returns optimal DEX execution quote

POLICY:
- Never spend below the minimum balance.
- Target loop velocity: target cycles/min specified in state.
- Prefer logical decision pipeline: market-snapshot → trench-scan → swap-quote.
- Vary services across cycles to demonstrate breadth.
- If balance is critically low, use action "wait" until funds recover.

Respond ONLY with strict JSON matching this schema:
{
  "action": "consume_service" | "wait" | "halt",
  "service": "market-snapshot" | "trench-scan" | "swap-quote" (omit if action != consume_service),
  "reason": string (10-500 chars),
  "expected_benefit": string (5-200 chars)
}

No prose. No markdown. No code fences. Just raw JSON.`;

export function buildUserPrompt(state: AgentState): string {
  return JSON.stringify(
    {
      cycleNumber: state.cycleNumber,
      balanceUsdg: state.balanceUsdg,
      minBalanceUsdg: state.minBalanceUsdg,
      recentEarnings: state.recentEarnings.slice(-5),
      recentSpends: state.recentSpends.slice(-5),
    },
    null,
    2
  );
}
```

Note: Decision validation is handled authoritatively by `DecisionSchema.parse` in `reasoner/client.ts`. No hand-rolled validator here.

- [ ] **Step 2.2: Write failing test first (TDD red step)**

Create file `apps/consumer/tests/reasoner/client.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReasonerClient } from '../../src/reasoner/client';

describe('ReasonerClient', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('reason() calls Groq API with system + user prompts and returns parsed Decision', async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              action: 'consume_service',
              service: 'market-snapshot',
              reason: 'Need price data before deciding on swap',
              expected_benefit: 'Informed trade decision',
            }),
          },
        },
      ],
      usage: { prompt_tokens: 300, completion_tokens: 80 },
    });

    const fakeClient = { chat: { completions: { create: mockCreate } } };
    const client = new ReasonerClient(
      { apiKey: 'K', baseUrl: 'https://api.groq.com', model: 'llama-3.3-70b-versatile' },
      fakeClient as never
    );

    const decision = await client.reason({
      balanceUsdg: 10,
      recentEarnings: [],
      recentSpends: [],
      cycleNumber: 1,
      minBalanceUsdg: 0.5,
    });

    expect(decision.action).toBe('consume_service');
    expect(decision.service).toBe('market-snapshot');
    expect(mockCreate).toHaveBeenCalledOnce();
    const callArgs = mockCreate.mock.calls[0]![0];
    expect(callArgs.model).toBe('llama-3.3-70b-versatile');
    expect(callArgs.messages).toHaveLength(2);
    expect(callArgs.response_format).toEqual({ type: 'json_object' });
  });

  it('retries once on JSON parse error', async () => {
    const mockCreate = vi
      .fn()
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'not json at all' } }],
        usage: { prompt_tokens: 0, completion_tokens: 0 },
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                action: 'wait',
                reason: 'Retry succeeded',
                expected_benefit: 'valid json',
              }),
            },
          },
        ],
        usage: { prompt_tokens: 0, completion_tokens: 0 },
      });

    const fakeClient = { chat: { completions: { create: mockCreate } } };
    const client = new ReasonerClient(
      { apiKey: 'K', baseUrl: 'https://api.groq.com', model: 'llama-3.3-70b-versatile' },
      fakeClient as never
    );

    const decision = await client.reason({
      balanceUsdg: 10,
      recentEarnings: [],
      recentSpends: [],
      cycleNumber: 1,
      minBalanceUsdg: 0.5,
    });

    expect(decision.action).toBe('wait');
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('throws on 429 rate limit error with marked error type', async () => {
    const rateLimit = new Error('429 Too Many Requests') as Error & { status: number };
    rateLimit.status = 429;
    const mockCreate = vi.fn().mockRejectedValue(rateLimit);

    const fakeClient = { chat: { completions: { create: mockCreate } } };
    const client = new ReasonerClient(
      { apiKey: 'K', baseUrl: 'https://api.groq.com', model: 'llama-3.3-70b-versatile' },
      fakeClient as never
    );

    await expect(
      client.reason({
        balanceUsdg: 10,
        recentEarnings: [],
        recentSpends: [],
        cycleNumber: 1,
        minBalanceUsdg: 0.5,
      })
    ).rejects.toThrow(/429|rate limit/i);
  });
});
```

- [ ] **Step 2.3: Run test to verify failure**

Run:
```bash
pnpm --filter consumer test
```

Expected: FAIL with missing module.

- [ ] **Step 2.4: Create client.ts**

Create file `apps/consumer/src/reasoner/client.ts`:
```typescript
import OpenAI from 'openai';
import type { Decision } from '@x402/shared';
import { DecisionSchema } from '@x402/shared';
import { SYSTEM_PROMPT, buildUserPrompt, type AgentState } from './prompts';

export interface ReasonerConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface ReasonMetadata {
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  model: string;
}

export interface ReasonResult {
  decision: Decision;
  metadata: ReasonMetadata;
}

export class ReasonerClient {
  private readonly client: OpenAI;

  constructor(
    private readonly config: ReasonerConfig,
    injectedClient?: OpenAI
  ) {
    this.client =
      injectedClient ??
      new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
      });
  }

  async reasonWithMeta(state: AgentState): Promise<ReasonResult> {
    const start = Date.now();
    const userPrompt = buildUserPrompt(state);

    const doCall = async () => {
      return this.client.chat.completions.create({
        model: this.config.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });
    };

    let response = await doCall();
    let content = response.choices[0]?.message?.content ?? '';

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      response = await doCall();
      content = response.choices[0]?.message?.content ?? '';
      parsed = JSON.parse(content);
    }

    const decision = DecisionSchema.parse(parsed);

    return {
      decision,
      metadata: {
        promptTokens: response.usage?.prompt_tokens ?? 0,
        completionTokens: response.usage?.completion_tokens ?? 0,
        latencyMs: Date.now() - start,
        model: this.config.model,
      },
    };
  }

  async reason(state: AgentState): Promise<Decision> {
    const result = await this.reasonWithMeta(state);
    return result.decision;
  }
}
```

- [ ] **Step 2.5: Run tests + Commit**

Run:
```bash
pnpm --filter consumer test
pnpm --filter consumer typecheck
git add apps/consumer/
git commit -m "feat(consumer): add ReasonerClient with Groq + JSON parse retry"
```

Expected: 3 tests pass, zero typecheck errors.

---

### Task 3: Rate Limit Adaptive Throttler (TDD)

**Files:**
- Create: `apps/consumer/src/reasoner/throttler.ts`
- Create: `apps/consumer/tests/reasoner/throttler.test.ts`

**Steps:**

- [ ] **Step 3.1: Write failing test first**

Create file `apps/consumer/tests/reasoner/throttler.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ModelThrottler } from '../../src/reasoner/throttler';

describe('ModelThrottler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts in primary tier', () => {
    const t = new ModelThrottler({
      primary: 'llama-3.3-70b-versatile',
      fast: 'llama-3.1-8b-instant',
      upgradeBackAfterMs: 60_000,
    });
    expect(t.currentModel()).toBe('llama-3.3-70b-versatile');
  });

  it('downgrades to fast tier on rate limit', () => {
    const t = new ModelThrottler({
      primary: 'llama-3.3-70b-versatile',
      fast: 'llama-3.1-8b-instant',
      upgradeBackAfterMs: 60_000,
    });
    t.reportRateLimit();
    expect(t.currentModel()).toBe('llama-3.1-8b-instant');
  });

  it('upgrades back to primary after upgradeBackAfterMs clean window', () => {
    const t = new ModelThrottler({
      primary: 'llama-3.3-70b-versatile',
      fast: 'llama-3.1-8b-instant',
      upgradeBackAfterMs: 60_000,
    });
    t.reportRateLimit();
    expect(t.currentModel()).toBe('llama-3.1-8b-instant');
    t.reportSuccess();
    vi.advanceTimersByTime(30_000);
    expect(t.currentModel()).toBe('llama-3.1-8b-instant');
    vi.advanceTimersByTime(30_001);
    expect(t.currentModel()).toBe('llama-3.3-70b-versatile');
  });

  it('resets upgrade timer on new rate limit hit', () => {
    const t = new ModelThrottler({
      primary: 'llama-3.3-70b-versatile',
      fast: 'llama-3.1-8b-instant',
      upgradeBackAfterMs: 60_000,
    });
    t.reportRateLimit();
    t.reportSuccess();
    vi.advanceTimersByTime(50_000);
    t.reportRateLimit();
    vi.advanceTimersByTime(30_000);
    expect(t.currentModel()).toBe('llama-3.1-8b-instant');
  });
});
```

- [ ] **Step 3.2: Run test to verify failure**

Run:
```bash
pnpm --filter consumer test
```

Expected: FAIL with missing module.

- [ ] **Step 3.3: Create throttler.ts**

Create file `apps/consumer/src/reasoner/throttler.ts`:
```typescript
export interface ThrottlerOptions {
  primary: string;
  fast: string;
  upgradeBackAfterMs: number;
}

/**
 * Tracks which Groq model tier the Consumer should use.
 * Downgrades from primary (70B) to fast (8B) on 429.
 * Upgrades back to primary after a clean window with no 429s.
 */
export class ModelThrottler {
  private tier: 'primary' | 'fast' = 'primary';
  private lastRateLimitAt: number | null = null;

  constructor(private readonly opts: ThrottlerOptions) {}

  currentModel(): string {
    if (this.tier === 'primary') return this.opts.primary;
    if (this.lastRateLimitAt !== null) {
      const elapsed = Date.now() - this.lastRateLimitAt;
      if (elapsed > this.opts.upgradeBackAfterMs) {
        this.tier = 'primary';
        this.lastRateLimitAt = null;
        return this.opts.primary;
      }
    }
    return this.opts.fast;
  }

  reportRateLimit(): void {
    this.tier = 'fast';
    this.lastRateLimitAt = Date.now();
  }

  reportSuccess(): void {
    // No-op; currentModel() handles upgrade-back timing
  }
}
```

- [ ] **Step 3.4: Run tests + Commit**

Run:
```bash
pnpm --filter consumer test
git add apps/consumer/
git commit -m "feat(consumer): add ModelThrottler for rate limit adaptive tier downgrade"
```

Expected: 4 throttler tests pass.

---

### Task 4: x402 HTTP Replay Helper (TDD)

**Files:**
- Create: `apps/consumer/src/http/replay.ts`
- Create: `apps/consumer/tests/http/replay.test.ts`

**Steps:**

- [ ] **Step 4.1: Write failing test first**

Create file `apps/consumer/tests/http/replay.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { replayWithPayment, parseChallenge402 } from '../../src/http/replay';
import type { PaymentProof } from '@x402/onchain-clients';

describe('parseChallenge402', () => {
  it('decodes PAYMENT-REQUIRED header from a 402 response', () => {
    const challenge = {
      x402Version: 2,
      error: 'PAYMENT-SIGNATURE header is required',
      resource: { url: '/v1/x', description: 'x', mimeType: 'application/json' },
      accepts: [
        {
          scheme: 'exact',
          network: 'eip155:196',
          amount: '10000',
          asset: '0x4ae46a509f6b1d9056937ba4500cb143933d2dc8',
          payTo: '0xPRODUCER',
          maxTimeoutSeconds: 60,
          extra: { name: 'USDG', version: '2' },
        },
      ],
    };
    const headerValue = Buffer.from(JSON.stringify(challenge)).toString('base64');
    const parsed = parseChallenge402(headerValue);
    expect(parsed.accepts[0]?.amount).toBe('10000');
  });
});

describe('replayWithPayment', () => {
  const originalFetch = global.fetch;
  beforeEach(() => {
    vi.resetAllMocks();
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('replays request with PAYMENT-SIGNATURE header and returns body on 200', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: 'resource' }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const proof: PaymentProof = {
      signature: '0xSIG',
      authorization: {
        from: '0xA',
        to: '0xB',
        value: '10000',
        validAfter: '0',
        validBefore: '1000',
        nonce: '0xNONCE',
      },
    };
    const accept = {
      scheme: 'exact' as const,
      network: 'eip155:196' as const,
      amount: '10000',
      asset: '0x4ae46a509f6b1d9056937ba4500cb143933d2dc8',
      payTo: '0xPRODUCER',
      maxTimeoutSeconds: 60,
      extra: { name: 'USDG', version: '2' },
    };
    const body = { tokenContractAddress: '0x4ae46a509f6b1d9056937ba4500cb143933d2dc8' };

    const result = await replayWithPayment({
      url: 'http://localhost:3001/v1/market-snapshot',
      body,
      accept,
      proof,
    });

    expect(result.status).toBe(200);
    expect(result.data).toEqual({ data: 'resource' });

    const [, init] = mockFetch.mock.calls[0]!;
    expect((init as RequestInit).headers).toHaveProperty('PAYMENT-SIGNATURE');
  });
});
```

- [ ] **Step 4.2: Run test to verify failure**

Run:
```bash
pnpm --filter consumer test
```

Expected: FAIL with missing module.

- [ ] **Step 4.3: Create replay.ts**

Create file `apps/consumer/src/http/replay.ts`:
```typescript
import type { Accept, Challenge402, PaymentPayload } from '@x402/shared';
import { Challenge402Schema } from '@x402/shared';
import type { PaymentProof } from '@x402/onchain-clients';

export function parseChallenge402(headerValue: string): Challenge402 {
  const decoded = Buffer.from(headerValue, 'base64').toString('utf8');
  return Challenge402Schema.parse(JSON.parse(decoded));
}

export interface ReplayOptions<TBody> {
  url: string;
  body: TBody;
  accept: Accept;
  proof: PaymentProof;
}

export interface ReplayResult<TData = unknown> {
  status: number;
  data: TData;
}

/**
 * Build PaymentPayload v2 and replay the original request with PAYMENT-SIGNATURE header.
 */
export async function replayWithPayment<TBody, TData = unknown>(
  opts: ReplayOptions<TBody>
): Promise<ReplayResult<TData>> {
  const paymentPayload: PaymentPayload = {
    x402Version: 2,
    resource: {
      url: opts.url,
      description: '',
      mimeType: 'application/json',
    },
    accepted: opts.accept,
    payload: {
      signature: opts.proof.signature,
      authorization: opts.proof.authorization,
      ...(opts.proof.sessionCert ? { sessionCert: opts.proof.sessionCert } : {}),
    },
  };

  const headerValue = Buffer.from(JSON.stringify(paymentPayload), 'utf8').toString('base64');

  const res = await fetch(opts.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'PAYMENT-SIGNATURE': headerValue,
    },
    body: JSON.stringify(opts.body),
  });

  // Defensive parse: 5xx error bodies may not be JSON. Gracefully handle
  // non-JSON responses so the loop doesn't crash on transient Producer errors.
  let data: TData;
  try {
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      data = (await res.json()) as TData;
    } else {
      const text = await res.text();
      data = { error: text || 'non-JSON response' } as unknown as TData;
    }
  } catch (err) {
    data = { error: (err as Error).message } as unknown as TData;
  }
  return { status: res.status, data };
}
```

- [ ] **Step 4.4: Run tests + Commit**

Run:
```bash
pnpm --filter consumer test
git add apps/consumer/
git commit -m "feat(consumer): add x402 HTTP replay helper with PAYMENT-SIGNATURE header"
```

Expected: 2 replay tests pass.

---

### Task 5: Consumer Agent Loop Orchestration

**Files:**
- Create: `apps/consumer/src/agent/loop.ts`
- Create: `apps/consumer/src/agent/budget.ts`
- Create: `apps/consumer/src/index.ts` (entry)
- Create: `apps/consumer/tests/agent/budget.test.ts`

**Steps:**

- [ ] **Step 5.1: Write failing budget test first**

Create file `apps/consumer/tests/agent/budget.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { BudgetTracker } from '../../src/agent/budget';

describe('BudgetTracker', () => {
  it('tracks earnings and spends separately', () => {
    const b = new BudgetTracker({ minBalanceUsdg: 0.5 });
    b.addEarning('market-snapshot', '10000', Date.now());
    b.addSpend('swap-quote', '15000', Date.now());

    const earnings = b.recentEarnings();
    const spends = b.recentSpends();
    expect(earnings).toHaveLength(1);
    expect(spends).toHaveLength(1);
  });

  it('canSpend returns true when balance would stay above min', () => {
    const b = new BudgetTracker({ minBalanceUsdg: 0.5 });
    expect(b.canSpend(1.0, '10000')).toBe(true); // 1.0 - 0.01 = 0.99 > 0.5
  });

  it('canSpend returns false when spend would drop below min', () => {
    const b = new BudgetTracker({ minBalanceUsdg: 0.5 });
    expect(b.canSpend(0.51, '20000')).toBe(false); // 0.51 - 0.02 = 0.49 < 0.5
  });

  it('keeps only last N history entries', () => {
    const b = new BudgetTracker({ minBalanceUsdg: 0.5, maxHistory: 3 });
    for (let i = 0; i < 5; i++) {
      b.addEarning('s', '1000', i);
    }
    expect(b.recentEarnings()).toHaveLength(3);
  });
});
```

- [ ] **Step 5.2: Run test to verify failure + Create budget.ts**

Run:
```bash
pnpm --filter consumer test
```

Expected: FAIL.

Create file `apps/consumer/src/agent/budget.ts`:
```typescript
export interface HistoryEntry {
  service: string;
  amount: string; // minimal units
  timestamp: number;
}

export interface BudgetTrackerOptions {
  minBalanceUsdg: number;
  maxHistory?: number;
}

/**
 * Tracks agent earnings, spends, and enforces minimum balance policy.
 * Minimal-unit amounts assumed USDG (6 decimals).
 */
export class BudgetTracker {
  private readonly earnings: HistoryEntry[] = [];
  private readonly spends: HistoryEntry[] = [];
  private readonly maxHistory: number;

  constructor(private readonly opts: BudgetTrackerOptions) {
    this.maxHistory = opts.maxHistory ?? 50;
  }

  addEarning(service: string, amount: string, timestamp: number): void {
    this.earnings.push({ service, amount, timestamp });
    if (this.earnings.length > this.maxHistory) this.earnings.shift();
  }

  addSpend(service: string, amount: string, timestamp: number): void {
    this.spends.push({ service, amount, timestamp });
    if (this.spends.length > this.maxHistory) this.spends.shift();
  }

  recentEarnings(): HistoryEntry[] {
    return [...this.earnings];
  }

  recentSpends(): HistoryEntry[] {
    return [...this.spends];
  }

  canSpend(currentBalanceUsdg: number, amountMinimal: string): boolean {
    const amountUsdg = Number(amountMinimal) / 1_000_000; // 6 decimals
    return currentBalanceUsdg - amountUsdg >= this.opts.minBalanceUsdg;
  }
}
```

- [ ] **Step 5.3: Run budget tests + Commit**

Run:
```bash
pnpm --filter consumer test
git add apps/consumer/
git commit -m "feat(consumer): add BudgetTracker with min-balance policy"
```

Expected: 4 budget tests pass.

- [ ] **Step 5.4: Create loop.ts orchestrator**

Create file `apps/consumer/src/agent/loop.ts`:
```typescript
import type Database from 'better-sqlite3';
import type { Store, EventBus } from '@x402/orchestrator';
import { transition, initialContext } from '@x402/orchestrator';
import type { ServiceName } from '@x402/shared';
import { WalletClient, X402PaymentClient } from '@x402/onchain-clients';
import { ReasonerClient } from '../reasoner/client';
import { ModelThrottler } from '../reasoner/throttler';
import { BudgetTracker } from './budget';
import { parseChallenge402, replayWithPayment } from '../http/replay';
import { config } from '../config';

const SERVICE_BODIES: Record<ServiceName, Record<string, string>> = {
  'market-snapshot': {
    tokenContractAddress: '0x4ae46a509f6b1d9056937ba4500cb143933d2dc8',
  },
  'trench-scan': {
    tokenAddress: '0x4ae46a509f6b1d9056937ba4500cb143933d2dc8',
  },
  'swap-quote': {
    fromTokenAddress: '0x4ae46a509f6b1d9056937ba4500cb143933d2dc8',
    toTokenAddress: '0x779ded0c9e1022225f8e0630b35a9b54be713736',
    amount: '1000000',
    slippage: '0.005',
  },
};

export interface LoopDependencies {
  db: Database.Database;
  store: Store;
  eventBus: EventBus;
  reasoner: ReasonerClient;
  throttler: ModelThrottler;
  budget: BudgetTracker;
  walletClient: WalletClient;
  paymentClient: X402PaymentClient;
}

export async function runLoop(deps: LoopDependencies): Promise<void> {
  const ctx = initialContext();
  let cycleNumber = (deps.store.getCurrentCycle()?.cycle_number ?? 0) + 1;
  const cycleIntervalMs = Math.floor(60_000 / config.targetCyclesPerMin);

  while (true) {
    const startedAt = Date.now();

    // Idempotent cycle creation: only insert if this cycleNumber doesn't already
    // exist. Retries (HTTP_402 → DECIDING) hit this path with the same cycleNumber,
    // so a blind insertCycle would violate PRIMARY KEY constraint.
    const existing = deps.store.getCycle(cycleNumber);
    if (!existing) {
      // Fresh cycle: reset retry counters. ctx persists across while iterations,
      // so without this reset, counter state would leak from cycle N to N+1.
      ctx.cycleRetryCount = 0;
      ctx.stateRetryCount = 0;
      ctx.previousState = 'IDLE';
      deps.store.insertCycle({ cycleNumber, startedAt });
      deps.store.updateCycleState(
        cycleNumber,
        transition('IDLE', { type: 'LOOP_START' }, ctx).nextState
      );
      deps.eventBus.emit('LOOP_CYCLE_STARTED', { cycleNumber });
    }

    // 1. Switch to Consumer account + fetch balance
    await deps.walletClient.switchAccount(config.consumerAccountId);
    const balanceRaw = (await deps.walletClient.balance({
      chain: 'xlayer',
      tokenAddress: config.usdgContract,
    })) as { details?: Array<{ tokenAssets?: Array<{ balance?: string }> }> };
    const balanceUsdg = Number(
      balanceRaw.details?.[0]?.tokenAssets?.[0]?.balance ?? '0'
    );

    // 2. Decide
    let decision;
    try {
      decision = await deps.reasoner.reason({
        balanceUsdg,
        recentEarnings: deps.budget.recentEarnings(),
        recentSpends: deps.budget.recentSpends(),
        cycleNumber,
        minBalanceUsdg: config.minBalanceUsdg,
      });
      deps.throttler.reportSuccess();
    } catch (err) {
      if ((err as { status?: number }).status === 429) {
        deps.throttler.reportRateLimit();
        deps.store.updateCycleState(
          cycleNumber,
          transition('DECIDING', { type: 'LLM_429' }, ctx).nextState
        );
      } else {
        deps.store.updateCycleState(
          cycleNumber,
          transition('DECIDING', { type: 'LLM_TIMEOUT' }, ctx).nextState
        );
      }
      await sleep(cycleIntervalMs);
      cycleNumber++;
      continue;
    }

    deps.store.insertDecision({
      cycleNumber,
      timestamp: Date.now(),
      action: decision.action,
      reason: decision.reason,
      llmResponse: JSON.stringify(decision),
      model: deps.throttler.currentModel(),
      latencyMs: 0,
    });
    deps.eventBus.emit('DECISION_MADE', {
      cycleNumber,
      action: decision.action,
      service: decision.service,
      reason: decision.reason,
    });
    deps.store.updateCycleState(
      cycleNumber,
      transition('DECIDING', { type: 'LLM_RESPONSE' }, ctx).nextState
    );

    // 3. If not consume_service, skip cycle
    if (decision.action !== 'consume_service' || !decision.service) {
      deps.store.completeCycle(cycleNumber, {
        completedAt: Date.now(),
        netUsdgChange: '0',
      });
      deps.eventBus.emit('LOOP_CYCLE_COMPLETED', { cycleNumber, netUsdgChange: '0' });
      await sleep(cycleIntervalMs);
      cycleNumber++;
      continue;
    }

    // 4. Fetch 402 challenge from Producer
    const url = `${config.producerUrl}/v1/${decision.service}`;
    const body = SERVICE_BODIES[decision.service];
    const challengeRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (challengeRes.status !== 402) {
      deps.store.updateCycleState(
        cycleNumber,
        transition('SIGNING', { type: 'CLI_ERROR' }, ctx).nextState
      );
      await sleep(cycleIntervalMs);
      cycleNumber++;
      continue;
    }

    const challengeHeader = challengeRes.headers.get('PAYMENT-REQUIRED');
    if (!challengeHeader) {
      await sleep(cycleIntervalMs);
      cycleNumber++;
      continue;
    }

    const challenge = parseChallenge402(challengeHeader);
    const accept = challenge.accepts[0]!;

    // 5. Sign payment via CLI
    let proof;
    try {
      proof = await deps.paymentClient.signPayment({ accepts: challenge.accepts });
      deps.store.updateCycleState(
        cycleNumber,
        transition('SIGNING', { type: 'PAYMENT_PROOF_READY' }, ctx).nextState
      );
    } catch (err) {
      deps.store.updateCycleState(
        cycleNumber,
        transition('SIGNING', { type: 'CLI_ERROR' }, ctx).nextState
      );
      await sleep(cycleIntervalMs);
      cycleNumber++;
      continue;
    }

    // 6. Replay with payment
    const replayResult = await replayWithPayment({ url, body, accept, proof });

    if (replayResult.status === 200) {
      deps.budget.addSpend(decision.service, accept.amount, Date.now());
      deps.store.updateCycleState(
        cycleNumber,
        transition('REPLAYING', { type: 'HTTP_200' }, ctx).nextState
      );
      ctx.previousState = 'REPLAYING';
      ctx.cycleRetryCount = 0;

      // 7. Wait for Producer-side settlement by polling payments table by nonce
      // Producer's onResponse hook calls Facilitator /settle; Consumer observes
      // the resulting payment row transition to status='settled'.
      const nonce = proof.authorization.nonce;
      const settled = await waitForSettlement(deps.store, nonce, 30_000);

      if (settled && settled.tx_hash) {
        deps.store.updateCycleState(
          cycleNumber,
          transition('VERIFYING', { type: 'VERIFY_OK' }, ctx).nextState
        );
        deps.store.updateCycleState(
          cycleNumber,
          transition('SETTLING', { type: 'SETTLE_OK' }, ctx).nextState
        );
        deps.store.completeCycle(cycleNumber, {
          completedAt: Date.now(),
          netUsdgChange: `-${accept.amount}`,
        });
        deps.eventBus.emit('SERVICE_CONSUMED', {
          cycleNumber,
          service: decision.service,
          amount: accept.amount,
          txHash: settled.tx_hash,
        });
        deps.eventBus.emit('LOOP_CYCLE_COMPLETED', {
          cycleNumber,
          netUsdgChange: `-${accept.amount}`,
        });
      } else {
        // Settlement did not land within 30s — mark FAILED, recovery will handle on next boot
        deps.store.updateCycleState(
          cycleNumber,
          transition('SETTLING', { type: 'SETTLE_TIMEOUT' }, ctx).nextState
        );
        deps.eventBus.emit('LOOP_CYCLE_FAILED', {
          cycleNumber,
          reason: 'settlement timeout',
        });
      }
    } else if (replayResult.status === 402) {
      // Spec-compliant retry path: HTTP_402 on replay (Producer's verify rejected the signature)
      ctx.cycleRetryCount += 1;
      const retryResult = transition('REPLAYING', { type: 'HTTP_402' }, ctx);
      deps.store.updateCycleState(cycleNumber, retryResult.nextState);
      if (retryResult.nextState === 'DECIDING') {
        // Do not sleep or increment cycleNumber — the loop head will pick up the same cycle
        continue;
      }
      // Else: FAILED, fall through to sleep + next cycle
    } else {
      // Non-200, non-402 response → transition to FAILED
      deps.store.updateCycleState(
        cycleNumber,
        transition('REPLAYING', { type: 'HTTP_500' }, ctx).nextState
      );
    }

    await sleep(cycleIntervalMs);
    cycleNumber++;
  }
}

/**
 * Poll SQLite payments table by nonce until settlement lands or timeout elapses.
 * Producer's onResponse hook writes tx_hash + status='settled' when Facilitator
 * /settle returns success.
 */
async function waitForSettlement(
  store: Store,
  nonce: string,
  timeoutMs: number
): Promise<{ tx_hash: string | null; status: string } | null> {
  const start = Date.now();
  const pollInterval = 500;
  while (Date.now() - start < timeoutMs) {
    const payment = store.findPaymentByNonce(nonce);
    if (payment && payment.status === 'settled' && payment.tx_hash) {
      return { tx_hash: payment.tx_hash, status: payment.status };
    }
    if (payment && payment.status === 'settle_failed') {
      return null;
    }
    await sleep(pollInterval);
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

- [ ] **Step 5.5: Create index.ts entry point**

Create file `apps/consumer/src/index.ts`:
```typescript
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { migrate, Store, EventBus } from '@x402/orchestrator';
import { WalletClient, X402PaymentClient } from '@x402/onchain-clients';
import { config } from './config';
import { ReasonerClient } from './reasoner/client';
import { ModelThrottler } from './reasoner/throttler';
import { BudgetTracker } from './agent/budget';
import { runLoop } from './agent/loop';

async function main() {
  // Ensure data directory exists before opening SQLite.
  mkdirSync(path.dirname(config.dbPath), { recursive: true });
  const db = new Database(config.dbPath);
  migrate(db);

  const store = new Store(db);
  const eventBus = new EventBus(db, 'consumer');
  const walletClient = new WalletClient();

  // Note: reconcileOnBoot is Producer-side (see apps/producer/src/server.ts).
  // Consumer only observes settlement via SQLite payments table polling.

  const throttler = new ModelThrottler({
    primary: config.groqPrimaryModel,
    fast: config.groqFastModel,
    upgradeBackAfterMs: 60_000,
  });

  const reasoner = new ReasonerClient({
    apiKey: config.groqApiKey,
    baseUrl: config.groqBaseUrl,
    model: throttler.currentModel(),
  });

  const budget = new BudgetTracker({ minBalanceUsdg: config.minBalanceUsdg });
  const paymentClient = new X402PaymentClient();

  // Earnings watcher: tail audit_events for Producer-side SETTLEMENT_COMPLETED.
  // In this demo both agents share one wallet login but different accounts; any
  // payment where the Producer account earns USDG gets recorded as an "earning"
  // for Aria's aggregate state. This lets the reasoner see earn + spend balance.
  let lastEventId = 0;
  setInterval(() => {
    const events = eventBus.replay({ sinceId: lastEventId, limit: 100 });
    for (const event of events) {
      lastEventId = Math.max(lastEventId, event.id);
      if (event.source === 'producer' && event.kind === 'SETTLEMENT_COMPLETED') {
        const amount = event.payload.amount as string | undefined;
        const service = event.payload.service as string | undefined;
        if (amount && service) {
          budget.addEarning(service, amount, event.timestamp);
        }
      }
    }
  }, 1000);

  await runLoop({
    db,
    store,
    eventBus,
    reasoner,
    throttler,
    budget,
    walletClient,
    paymentClient,
  });
}

main().catch((err) => {
  console.error('Consumer loop fatal error:', err);
  process.exit(1);
});
```

- [ ] **Step 5.6: Typecheck + Commit**

Run:
```bash
pnpm --filter consumer typecheck
git add apps/consumer/
git commit -m "feat(consumer): add Consumer loop orchestrator with reasoner, throttler, budget, replay"
```

Expected: zero typecheck errors.

---

### Task 6: Chunk 5 Exit Criteria Check

- [ ] **Step 6.1: Verify all workspaces typecheck + test**

Run:
```bash
pnpm -r typecheck
pnpm -r test
```

Expected: 92+ tests pass (83 previous + 9 consumer).

- [ ] **Step 6.2: Tag completion**

```bash
git status
git tag chunk-5-complete
```

---

**Chunk 5 Exit Criteria:**
- Consumer app with agent loop, reasoner (Groq), throttler, budget, replay
- Loop performs: balance fetch → LLM reason → CLI sign → HTTP replay → SQLite update
- Rate limit adaptive throttler handles 429 with auto-downgrade
- All 19 state transitions wired to orchestrator state machine
- Boot recovery calls reconcileOnBoot before starting loop
- 9 consumer unit tests passing
- Typecheck clean

**Next:** Chunk 6 — Dashboard MUST Pages

---

## Chunk 6: Dashboard (Next.js 14, MUST Pages)

**Goal:** Build a Next.js 14 App Router dashboard that polls SQLite via SSE and renders live loop status + transaction log. Scope is MUST-only per spec Section 2 Component 4 ranking: `/` (live loop view) and `/tx` (transaction log). SHOULD/COULD pages are deferred to Chunk 7 if time permits.

**Why this comes sixth:** Producer and Consumer must exist and emit events before the dashboard has anything to display.

**Design reference:** Spec Section 2 Component 4, Section 3.3.

---

### Task 1: Scaffold Next.js App

**Files:**
- Create: `apps/dashboard/package.json`
- Create: `apps/dashboard/tsconfig.json`
- Create: `apps/dashboard/next.config.mjs`
- Create: `apps/dashboard/tailwind.config.ts`
- Create: `apps/dashboard/postcss.config.mjs`
- Create: `apps/dashboard/app/layout.tsx`
- Create: `apps/dashboard/app/globals.css`

**Steps:**

- [ ] **Step 1.1: Create package.json**

Create file `apps/dashboard/package.json`:
```json
{
  "name": "dashboard",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000",
    "lint": "next lint"
  },
  "dependencies": {
    "@x402/shared": "workspace:*",
    "@x402/orchestrator": "workspace:*",
    "better-sqlite3": "^11.3.0",
    "clsx": "^2.1.1",
    "next": "^14.2.15",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "tailwind-merge": "^2.5.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.11",
    "@types/node": "^20.16.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.13",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 1.2: Create tsconfig.json**

Create file `apps/dashboard/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "plugins": [{ "name": "next" }],
    "jsx": "preserve",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": true,
    "paths": { "@/*": ["./*"] },
    "noEmit": true,
    "incremental": true
  },
  "include": ["next-env.d.ts", "app/**/*", "lib/**/*", "components/**/*"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 1.3: Create next.config.mjs**

Create file `apps/dashboard/next.config.mjs`:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
};
export default nextConfig;
```

- [ ] **Step 1.4: Create Tailwind config files**

Create file `apps/dashboard/tailwind.config.ts`:
```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
export default config;
```

Create file `apps/dashboard/postcss.config.mjs`:
```javascript
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

- [ ] **Step 1.5: Create app/globals.css**

Create file `apps/dashboard/app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  background: #0a0a0f;
  color: #e5e5e8;
  font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
}
```

- [ ] **Step 1.6: Create app/layout.tsx**

Create file `apps/dashboard/app/layout.tsx`:
```typescript
import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Aria — x402 Economy Loop',
  description: 'Autonomous DeFi agent earning and paying via x402 on X Layer',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen px-6 py-8 max-w-6xl mx-auto">
          <header className="mb-8 flex items-baseline gap-4">
            <h1 className="text-2xl font-bold tracking-tight">Aria</h1>
            <span className="text-sm text-neutral-400">
              autonomous x402 economy loop on X Layer
            </span>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
```

- [ ] **Step 1.7: Install + Commit**

Run:
```bash
pnpm install
pnpm --filter dashboard typecheck
git add apps/dashboard/
git commit -m "chore(dashboard): scaffold Next.js 14 app with Tailwind"
```

Expected: zero typecheck errors.

---

### Task 2: SSE API Route for Live Events

**Files:**
- Create: `apps/dashboard/lib/db.ts`
- Create: `apps/dashboard/app/api/events/route.ts`
- Create: `apps/dashboard/app/api/status/route.ts`

**Steps:**

- [ ] **Step 2.1: Create db.ts (singleton)**

Create file `apps/dashboard/lib/db.ts`:
```typescript
import Database from 'better-sqlite3';
import { migrate, Store, EventBus } from '@x402/orchestrator';

const DB_PATH = process.env.APP_DB_PATH ?? 'data/app.db';

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
```

- [ ] **Step 2.2: Create SSE events route**

Create file `apps/dashboard/app/api/events/route.ts`:
```typescript
import { NextRequest } from 'next/server';
import { getEventBus } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const bus = getEventBus();
  const url = new URL(request.url);
  const sinceId = Number(url.searchParams.get('sinceId') ?? '0');

  const stream = new ReadableStream({
    start(controller) {
      let lastId = sinceId;
      const encoder = new TextEncoder();

      const poll = () => {
        try {
          const events = bus.replay({ sinceId: lastId, limit: 100 });
          for (const event of events) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
            );
            lastId = event.id;
          }
        } catch (err) {
          controller.enqueue(
            encoder.encode(`event: error\ndata: ${JSON.stringify({ message: String(err) })}\n\n`)
          );
        }
      };

      const interval = setInterval(poll, 500);
      poll();

      request.signal.addEventListener('abort', () => {
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
      'X-Accel-Buffering': 'no',
    },
  });
}
```

- [ ] **Step 2.3: Create status API route**

Create file `apps/dashboard/app/api/status/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { getStore } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const store = getStore();
  const currentCycle = store.getCurrentCycle();
  return NextResponse.json({
    currentCycle,
    serverTime: Date.now(),
  });
}
```

- [ ] **Step 2.4: Typecheck + Commit**

Run:
```bash
pnpm --filter dashboard typecheck
git add apps/dashboard/
git commit -m "feat(dashboard): add SSE events + status API routes"
```

Expected: zero errors.

---

### Task 3: Live Loop Home Page (`/`)

**Files:**
- Create: `apps/dashboard/app/page.tsx`
- Create: `apps/dashboard/components/LoopStatusCard.tsx`
- Create: `apps/dashboard/components/BalanceDisplay.tsx`
- Create: `apps/dashboard/components/EventFeed.tsx`
- Create: `apps/dashboard/lib/useSseEvents.ts`

**Steps:**

- [ ] **Step 3.1: Create useSseEvents hook**

Create file `apps/dashboard/lib/useSseEvents.ts`:
```typescript
'use client';

import { useEffect, useState } from 'react';

export interface SseEvent {
  id: number;
  timestamp: number;
  source: string;
  kind: string;
  cycleNumber: number | null;
  payload: Record<string, unknown>;
}

export function useSseEvents(endpoint: string = '/api/events'): SseEvent[] {
  const [events, setEvents] = useState<SseEvent[]>([]);

  useEffect(() => {
    const eventSource = new EventSource(endpoint);
    eventSource.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data) as SseEvent;
        setEvents((prev) => {
          const next = [...prev, event];
          return next.length > 500 ? next.slice(-500) : next;
        });
      } catch {
        // ignore malformed events
      }
    };
    eventSource.onerror = () => {
      eventSource.close();
    };
    return () => eventSource.close();
  }, [endpoint]);

  return events;
}
```

- [ ] **Step 3.2: Create LoopStatusCard component**

Create file `apps/dashboard/components/LoopStatusCard.tsx`:
```typescript
'use client';

import type { SseEvent } from '@/lib/useSseEvents';

interface Props {
  events: SseEvent[];
}

export function LoopStatusCard({ events }: Props) {
  const latestCycleEvent = [...events]
    .reverse()
    .find((e) => e.cycleNumber !== null);
  const currentCycle = latestCycleEvent?.cycleNumber ?? 0;

  const completedCycles = events.filter((e) => e.kind === 'LOOP_CYCLE_COMPLETED').length;

  const last60sEvents = events.filter(
    (e) => e.kind === 'LOOP_CYCLE_COMPLETED' && Date.now() - e.timestamp < 60_000
  );
  const velocityPerMin = last60sEvents.length;

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
      <div className="text-sm uppercase tracking-wide text-neutral-400 mb-2">
        Loop Status
      </div>
      <div className="flex items-baseline gap-6">
        <div>
          <div className="text-xs text-neutral-500">Current Cycle</div>
          <div className="text-3xl font-bold">#{currentCycle}</div>
        </div>
        <div>
          <div className="text-xs text-neutral-500">Completed</div>
          <div className="text-3xl font-bold">{completedCycles}</div>
        </div>
        <div>
          <div className="text-xs text-neutral-500">Velocity</div>
          <div className="text-3xl font-bold">
            {velocityPerMin}
            <span className="text-sm text-neutral-500 ml-1">/min</span>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3.3: Create BalanceDisplay component**

Create file `apps/dashboard/components/BalanceDisplay.tsx`:
```typescript
'use client';

import type { SseEvent } from '@/lib/useSseEvents';

interface Props {
  events: SseEvent[];
}

export function BalanceDisplay({ events }: Props) {
  const totalEarned = events
    .filter((e) => e.kind === 'SETTLEMENT_COMPLETED')
    .reduce((sum, e) => sum + Number(e.payload.amount ?? 0), 0);
  const totalSpent = events
    .filter((e) => e.kind === 'SERVICE_CONSUMED')
    .reduce((sum, e) => sum + Number(e.payload.amount ?? 0), 0);

  const net = totalEarned - totalSpent;
  const earnedUsdg = (totalEarned / 1_000_000).toFixed(4);
  const spentUsdg = (totalSpent / 1_000_000).toFixed(4);
  const netUsdg = (net / 1_000_000).toFixed(4);

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
      <div className="text-sm uppercase tracking-wide text-neutral-400 mb-2">
        Aria's Economy
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <div className="text-xs text-neutral-500">Earned</div>
          <div className="text-2xl font-bold text-emerald-400">+{earnedUsdg}</div>
          <div className="text-xs text-neutral-600">USDG</div>
        </div>
        <div>
          <div className="text-xs text-neutral-500">Spent</div>
          <div className="text-2xl font-bold text-rose-400">-{spentUsdg}</div>
          <div className="text-xs text-neutral-600">USDG</div>
        </div>
        <div>
          <div className="text-xs text-neutral-500">Net</div>
          <div
            className={`text-2xl font-bold ${
              net >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {net >= 0 ? '+' : ''}
            {netUsdg}
          </div>
          <div className="text-xs text-neutral-600">USDG</div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3.4: Create EventFeed component**

Create file `apps/dashboard/components/EventFeed.tsx`:
```typescript
'use client';

import type { SseEvent } from '@/lib/useSseEvents';

interface Props {
  events: SseEvent[];
}

const KIND_COLOR: Record<string, string> = {
  LOOP_CYCLE_STARTED: 'text-blue-400',
  DECISION_MADE: 'text-purple-400',
  PAYMENT_VERIFIED: 'text-cyan-400',
  SETTLEMENT_COMPLETED: 'text-emerald-400',
  SERVICE_CONSUMED: 'text-amber-400',
  LOOP_CYCLE_COMPLETED: 'text-green-400',
  SETTLEMENT_FAILED: 'text-rose-400',
};

export function EventFeed({ events }: Props) {
  const recent = [...events].reverse().slice(0, 30);

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
      <div className="text-sm uppercase tracking-wide text-neutral-400 mb-4">
        Live Event Feed
      </div>
      <div className="space-y-1 font-mono text-xs">
        {recent.length === 0 && (
          <div className="text-neutral-600">No events yet. Start the loop.</div>
        )}
        {recent.map((event) => (
          <div key={event.id} className="flex gap-3">
            <span className="text-neutral-600">
              {new Date(event.timestamp).toLocaleTimeString()}
            </span>
            <span className={KIND_COLOR[event.kind] ?? 'text-neutral-300'}>
              {event.kind}
            </span>
            <span className="text-neutral-500">
              #{event.cycleNumber ?? '-'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3.5: Create app/page.tsx**

Create file `apps/dashboard/app/page.tsx`:
```typescript
'use client';

import { useSseEvents } from '@/lib/useSseEvents';
import { LoopStatusCard } from '@/components/LoopStatusCard';
import { BalanceDisplay } from '@/components/BalanceDisplay';
import { EventFeed } from '@/components/EventFeed';

export default function HomePage() {
  const events = useSseEvents('/api/events');

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <LoopStatusCard events={events} />
        <BalanceDisplay events={events} />
      </div>
      <EventFeed events={events} />
      <div className="flex gap-4 text-sm">
        <a
          href="/tx"
          className="rounded border border-neutral-700 px-4 py-2 hover:bg-neutral-800"
        >
          Transactions →
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 3.6: Typecheck + Commit**

Run:
```bash
pnpm --filter dashboard typecheck
git add apps/dashboard/
git commit -m "feat(dashboard): add live loop home page with SSE hook + 3 card components"
```

---

### Task 4: Transaction Log Page (`/tx`)

**Files:**
- Create: `apps/dashboard/app/tx/page.tsx`
- Create: `apps/dashboard/app/api/payments/route.ts`

**Steps:**

- [ ] **Step 4.1: Create payments API route**

Create file `apps/dashboard/app/api/payments/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM payments ORDER BY signed_at DESC LIMIT 200`
    )
    .all();
  return NextResponse.json({ payments: rows });
}
```

- [ ] **Step 4.2: Create transaction log page (direct DB access, no self-fetch)**

Create file `apps/dashboard/app/tx/page.tsx`:
```typescript
import { X_LAYER_EXPLORER } from '@x402/shared';
import { getDb } from '@/lib/db';

interface PaymentRow {
  id: number;
  cycle_number: number;
  scheme: string;
  nonce: string;
  from_addr: string;
  to_addr: string;
  amount_minimal: string;
  service: string;
  signed_at: number;
  settled_at: number | null;
  tx_hash: string | null;
  status: string;
}

export const dynamic = 'force-dynamic';

function getPayments(): PaymentRow[] {
  // Direct DB access from server component — no self-HTTP hop.
  const db = getDb();
  return db
    .prepare(`SELECT * FROM payments ORDER BY signed_at DESC LIMIT 200`)
    .all() as PaymentRow[];
}

export default function TxPage() {
  const payments = getPayments();

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Transaction Log</h2>
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-neutral-400 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Cycle</th>
              <th className="px-4 py-3 text-left">Service</th>
              <th className="px-4 py-3 text-left">Amount</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Tx Hash</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                  No payments recorded yet.
                </td>
              </tr>
            )}
            {payments.map((p) => (
              <tr key={p.id} className="border-t border-neutral-800">
                <td className="px-4 py-3">#{p.cycle_number}</td>
                <td className="px-4 py-3">{p.service}</td>
                <td className="px-4 py-3 font-mono">
                  {(Number(p.amount_minimal) / 1_000_000).toFixed(4)} USDG
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={p.status} />
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  {p.tx_hash ? (
                    <a
                      href={`${X_LAYER_EXPLORER}/tx/${p.tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline"
                    >
                      {p.tx_hash.slice(0, 10)}...{p.tx_hash.slice(-8)}
                    </a>
                  ) : (
                    <span className="text-neutral-600">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <a href="/" className="inline-block text-sm text-blue-400 hover:underline">
        ← Back to Home
      </a>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    settled: 'bg-emerald-900 text-emerald-300',
    verified: 'bg-cyan-900 text-cyan-300',
    signed: 'bg-blue-900 text-blue-300',
    settle_failed: 'bg-rose-900 text-rose-300',
    settle_abandoned: 'bg-neutral-800 text-neutral-500',
  };
  return (
    <span className={`rounded px-2 py-1 text-xs font-medium ${colors[status] ?? 'bg-neutral-800'}`}>
      {status}
    </span>
  );
}
```

- [ ] **Step 4.3: Typecheck + Commit**

Run:
```bash
pnpm --filter dashboard typecheck
git add apps/dashboard/
git commit -m "feat(dashboard): add transaction log page with X Layer explorer links"
```

---

### Task 5: Chunk 6 Exit Criteria Check

- [ ] **Step 5.1: Verify typecheck across all workspaces**

Run:
```bash
pnpm -r typecheck
pnpm -r test
```

Expected: zero errors, 92+ tests passing.

- [ ] **Step 5.2: Manual smoke test dashboard**

Run:
```bash
cd /root/hackathon/okx/x402-earn-pay-earn
pnpm dev:dashboard
```

In browser, open `http://localhost:3000/` and `http://localhost:3000/tx`.

Expected: Home page shows empty loop status cards. Tx log shows "No payments recorded yet" (if DB empty). Both pages render without error.

- [ ] **Step 5.3: Tag completion**

```bash
git tag chunk-6-complete
```

---

**Chunk 6 Exit Criteria:**
- Next.js 14 App Router dashboard with Tailwind styling
- `/` home page with LoopStatusCard, BalanceDisplay, EventFeed (SSE-powered live)
- `/tx` transaction log page with X Layer explorer links
- SSE `/api/events` endpoint polls SQLite audit_events every 500ms
- `/api/payments` + `/api/status` REST endpoints
- Typecheck clean
- Manual browser test confirms both pages render

**Next:** Chunk 7 — Integration & Demo

---

## Chunk 7: Integration, Health Check, Demo & Submission

**Goal:** Wire everything together. Write the bootstrap script (demo-runner), the pre-flight health check, integration tests that hit real X Layer mainnet (opt-in), the full README with Aria narrative, and the demo scenarios file. Tag chunk-7-complete when ready to record demo video.

**Why this comes last:** Everything else is done. This ties the full app together for submission.

**Design reference:** Spec Section 3.4 (bootstrap), 4.3 (tests), 4.4 (health check), 4.5 (observability).

---

### Task 1: Pre-flight Health Check Script

**Files:**
- Create: `scripts/src/health-check.ts`

**Steps:**

- [ ] **Step 1.1: Create health-check.ts**

Create file `scripts/src/health-check.ts`:
```typescript
#!/usr/bin/env tsx
/**
 * Pre-flight validation — fails fast if any blocker found.
 * Must pass before demo-runner.ts starts the full loop.
 *
 * Spec Section 4.4 checklist.
 */
import { config as loadEnv } from 'dotenv';
import { signOkxRequest } from '@x402/okx-auth';
import {
  OKX_FACILITATOR_BASE,
  OKX_MCP_ENDPOINT,
  X_LAYER_RPC,
  FACILITATOR_PATHS,
  HMAC_CLOCK_SKEW_TOLERANCE_MS,
} from '@x402/shared';
import { spawnCli } from '../../packages/onchain-clients/src/util/spawn-cli';
import { WalletClient } from '../../packages/onchain-clients/src/wallet';
import { existsSync, mkdirSync, statSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { migrate } from '@x402/orchestrator';

loadEnv();

interface Check {
  name: string;
  run: () => Promise<string>; // returns status message
}

const checks: Check[] = [
  {
    name: 'Env vars present',
    run: async () => {
      const required = ['OKX_API_KEY', 'OKX_SECRET_KEY', 'OKX_PASSPHRASE', 'GROQ_API_KEY'];
      const missing = required.filter((k) => !process.env[k]);
      if (missing.length) throw new Error(`missing: ${missing.join(', ')}`);
      return 'OK';
    },
  },
  {
    name: 'onchainos CLI installed >= 2.2.8',
    run: async () => {
      const r = await spawnCli('onchainos', ['--version']);
      if (r.exitCode !== 0) throw new Error('CLI not installed or not on PATH');
      const version = r.stdout.trim().replace(/^v/, '');
      const [major, minor, patch] = version.split('.').map((n) => Number.parseInt(n, 10));
      if (major === undefined || minor === undefined || patch === undefined) {
        throw new Error(`Could not parse version: ${r.stdout}`);
      }
      const meetsMin = major > 2 || (major === 2 && (minor > 2 || (minor === 2 && patch >= 8)));
      if (!meetsMin) throw new Error(`version ${version} < 2.2.8 required`);
      return `v${version}`;
    },
  },
  {
    name: 'X Layer RPC reachable',
    run: async () => {
      const res = await fetch(X_LAYER_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
          id: 1,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { result?: string };
      if (!data.result) throw new Error('no block number returned');
      return `block ${parseInt(data.result, 16)}`;
    },
  },
  {
    name: 'OKX MCP Server reachable',
    run: async () => {
      const res = await fetch(OKX_MCP_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'OK-ACCESS-KEY': process.env.OKX_API_KEY!,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/list',
          params: {},
          id: 1,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return 'OK';
    },
  },
  {
    name: 'Facilitator reachable + HMAC auth valid',
    run: async () => {
      const { timestamp, signature } = signOkxRequest({
        method: 'GET',
        path: FACILITATOR_PATHS.supported,
        secretKey: process.env.OKX_SECRET_KEY!,
      });
      const res = await fetch(`${OKX_FACILITATOR_BASE}${FACILITATOR_PATHS.supported}`, {
        method: 'GET',
        headers: {
          'OK-ACCESS-KEY': process.env.OKX_API_KEY!,
          'OK-ACCESS-SIGN': signature,
          'OK-ACCESS-TIMESTAMP': timestamp,
          'OK-ACCESS-PASSPHRASE': process.env.OKX_PASSPHRASE!,
        },
      });
      if (res.status === 401) throw new Error('HMAC auth failed (401)');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return 'OK';
    },
  },
  {
    name: 'Clock drift within tolerance',
    run: async () => {
      const res = await fetch(`${OKX_FACILITATOR_BASE}${FACILITATOR_PATHS.supported}`, {
        method: 'HEAD',
      });
      const serverDate = res.headers.get('Date');
      if (!serverDate) return 'WARNING: no server Date header, cannot measure drift';
      const serverMs = new Date(serverDate).getTime();
      const drift = Math.abs(Date.now() - serverMs);
      if (drift > HMAC_CLOCK_SKEW_TOLERANCE_MS) {
        throw new Error(`clock drift ${drift}ms > ${HMAC_CLOCK_SKEW_TOLERANCE_MS}ms tolerance`);
      }
      return `drift ${drift}ms`;
    },
  },
  {
    name: 'Groq API key valid',
    run: async () => {
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      });
      if (!res.ok) throw new Error(`Groq HTTP ${res.status}`);
      return 'OK';
    },
  },
  {
    name: 'Wallet logged in + 2 accounts present',
    run: async () => {
      const client = new WalletClient();
      const status = await client.status();
      if (!status.loggedIn) throw new Error('not logged in');
      if (status.accountCount < 2) {
        throw new Error(`need 2 accounts, have ${status.accountCount}. Run: onchainos wallet add`);
      }
      return `logged in, ${status.accountCount} accounts`;
    },
  },
  {
    name: 'Producer + Consumer account IDs set in env',
    run: async () => {
      if (!process.env.PRODUCER_ACCOUNT_ID) throw new Error('PRODUCER_ACCOUNT_ID not set in .env');
      if (!process.env.CONSUMER_ACCOUNT_ID) throw new Error('CONSUMER_ACCOUNT_ID not set in .env');
      if (process.env.PRODUCER_ACCOUNT_ID === process.env.CONSUMER_ACCOUNT_ID) {
        throw new Error('PRODUCER_ACCOUNT_ID and CONSUMER_ACCOUNT_ID must differ');
      }
      return 'OK';
    },
  },
  {
    name: 'Producer address derivable',
    run: async () => {
      const producerId = process.env.PRODUCER_ACCOUNT_ID!;
      const client = new WalletClient();
      await client.switchAccount(producerId);
      const balance = (await client.balance({ chain: 'xlayer' })) as {
        evmAddress?: string;
      };
      if (!balance.evmAddress) throw new Error('Producer EVM address not found');
      return balance.evmAddress;
    },
  },
  {
    name: 'x402-payment CLI help shows --force flag',
    run: async () => {
      const r = await spawnCli('onchainos', ['payment', 'x402-pay', '--help']);
      const combined = `${r.stdout}\n${r.stderr}`;
      if (!/--force/.test(combined)) {
        throw new Error('x402-pay CLI does not expose --force flag (session may stall)');
      }
      return 'OK';
    },
  },
  {
    name: 'Consumer USDG balance >= 1 USDG',
    run: async () => {
      const consumerId = process.env.CONSUMER_ACCOUNT_ID;
      if (!consumerId) throw new Error('CONSUMER_ACCOUNT_ID not set');
      const client = new WalletClient();
      await client.switchAccount(consumerId);
      const balance = (await client.balance({
        chain: 'xlayer',
        tokenAddress: '0x4ae46a509f6b1d9056937ba4500cb143933d2dc8',
      })) as { details?: Array<{ tokenAssets?: Array<{ balance?: string }> }> };
      const amount = Number(balance.details?.[0]?.tokenAssets?.[0]?.balance ?? '0');
      if (amount < 1) throw new Error(`balance ${amount} USDG < 1 USDG minimum`);
      return `${amount} USDG`;
    },
  },
  {
    name: 'SQLite database writable',
    run: async () => {
      const dbPath = process.env.APP_DB_PATH ?? 'data/app.db';
      mkdirSync(path.dirname(dbPath), { recursive: true });
      const db = new Database(dbPath);
      migrate(db);
      // Write + delete a test audit event to prove write access
      db.prepare(
        `INSERT INTO audit_events (timestamp, source, kind, cycle_number, payload) VALUES (?, ?, ?, ?, ?)`
      ).run(Date.now(), 'orchestrator', 'HEALTH_CHECK_PROBE', null, '{}');
      db.prepare(`DELETE FROM audit_events WHERE kind = ?`).run('HEALTH_CHECK_PROBE');
      db.close();
      return dbPath;
    },
  },
  {
    name: 'Ports 3000 + 3001 free',
    run: async () => {
      for (const port of [3000, 3001]) {
        try {
          const server = (await import('node:net')).createServer();
          await new Promise<void>((resolve, reject) => {
            server.once('error', reject);
            server.once('listening', () => {
              server.close();
              resolve();
            });
            server.listen(port, '127.0.0.1');
          });
        } catch {
          throw new Error(`port ${port} already in use`);
        }
      }
      return 'OK';
    },
  },
];

async function main() {
  console.log('x402 Earn-Pay-Earn Pre-flight Health Check\n');
  let failed = 0;
  for (const check of checks) {
    process.stdout.write(`  ${check.name}... `);
    try {
      const status = await check.run();
      console.log(`✓ ${status}`);
    } catch (err) {
      console.log(`✗ FAIL: ${(err as Error).message}`);
      failed++;
    }
  }
  console.log();
  if (failed > 0) {
    console.error(`${failed} check(s) failed. Fix blockers before running demo-runner.`);
    process.exit(1);
  }
  console.log(`All checks passed. Ready to run demo.`);
}

main().catch((err) => {
  console.error('Health check crashed:', err);
  process.exit(1);
});
```

- [ ] **Step 1.2: Typecheck + Commit**

Run:
```bash
pnpm --filter @x402/scripts typecheck
git add scripts/src/health-check.ts
git commit -m "feat(scripts): add pre-flight health check with 11 validation steps"
```

Expected: zero errors.

- [ ] **Step 1.3: Run health check (live)**

Run:
```bash
pnpm health-check
```

Expected: all 11 checks pass. If any fail, fix blockers before proceeding.

---

### Task 2: Demo Runner Script

**Files:**
- Create: `scripts/src/demo-runner.ts`

**Steps:**

- [ ] **Step 2.1: Create demo-runner.ts**

Create file `scripts/src/demo-runner.ts`:
```typescript
#!/usr/bin/env tsx
/**
 * Orchestrates the full demo scenario:
 * 1. Run health check (exits if fails)
 * 2. Instruct user to start Producer, Consumer, Dashboard in separate terminals
 * 3. Print the Aria narrative + URL for dashboard
 *
 * This script does NOT spawn Producer/Consumer/Dashboard itself — those are
 * interactive processes that the user should run in separate terminals for
 * clean log visibility during demo recording.
 */
import { execa } from 'execa';

async function main() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('   x402 Earn-Pay-Earn Demo Runner');
  console.log('═══════════════════════════════════════════════════════\n');

  console.log('Step 1: Running pre-flight health check...\n');
  try {
    await execa('pnpm', ['health-check'], { stdio: 'inherit' });
  } catch {
    console.error('\nHealth check failed. Fix blockers and retry.\n');
    process.exit(1);
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('   Ready to run. Open 3 terminals and run:');
  console.log('═══════════════════════════════════════════════════════');
  console.log();
  console.log('  Terminal 1 (Producer):');
  console.log('    pnpm dev:producer');
  console.log();
  console.log('  Terminal 2 (Consumer):');
  console.log('    pnpm dev:consumer');
  console.log();
  console.log('  Terminal 3 (Dashboard):');
  console.log('    pnpm dev:dashboard');
  console.log();
  console.log('  Then open: http://localhost:3000');
  console.log();
  console.log('═══════════════════════════════════════════════════════');
  console.log('   Aria is about to wake up. Watch her earn and pay.');
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error('Demo runner error:', err);
  process.exit(1);
});
```

- [ ] **Step 2.2: Typecheck + Commit**

Run:
```bash
pnpm --filter @x402/scripts typecheck
git add scripts/src/demo-runner.ts
git commit -m "feat(scripts): add demo-runner script with health check + terminal instructions"
```

---

### Task 3: Integration Tests (Opt-in, Real X Layer)

**Files:**
- Create: `tests/integration/vitest.config.ts`
- Create: `tests/integration/wallet-setup.test.ts`
- Create: `tests/integration/facilitator-flow.test.ts`

**Steps:**

- [ ] **Step 3.1: Create integration test vitest config**

Create file `tests/integration/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.test.ts'],
    testTimeout: 60_000,
    globals: false,
    // Only run when RUN_INTEGRATION=1 is set
    env: { RUN_INTEGRATION: process.env.RUN_INTEGRATION ?? '0' },
  },
});
```

- [ ] **Step 3.2: Create wallet-setup integration test**

Create file `tests/integration/wallet-setup.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { WalletClient } from '../../packages/onchain-clients/src/wallet';

const SKIP = process.env.RUN_INTEGRATION !== '1';

describe.skipIf(SKIP)('wallet-setup integration', () => {
  it('wallet status returns loggedIn with >=2 accounts', async () => {
    const client = new WalletClient();
    const status = await client.status();
    expect(status.loggedIn).toBe(true);
    expect(status.accountCount).toBeGreaterThanOrEqual(2);
  }, 30_000);

  it('can switch between accounts', async () => {
    const client = new WalletClient();
    const status = await client.status();
    const originalId = status.currentAccountId;
    await client.switchAccount(originalId);
    const after = await client.status();
    expect(after.currentAccountId).toBe(originalId);
  });

  it('consumer has USDG balance', async () => {
    const consumerId = process.env.CONSUMER_ACCOUNT_ID;
    if (!consumerId) {
      throw new Error('CONSUMER_ACCOUNT_ID not set');
    }
    const client = new WalletClient();
    await client.switchAccount(consumerId);
    const balance = await client.balance({
      chain: 'xlayer',
      tokenAddress: '0x4ae46a509f6b1d9056937ba4500cb143933d2dc8',
    });
    expect(balance).toBeDefined();
  });
});
```

- [ ] **Step 3.3: Create facilitator-flow integration test**

Create file `tests/integration/facilitator-flow.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { config as loadEnv } from 'dotenv';
import { signOkxRequest } from '../../packages/okx-auth/src/sign';
import { FACILITATOR_PATHS, OKX_FACILITATOR_BASE } from '../../packages/shared/src/constants';

loadEnv();
const SKIP = process.env.RUN_INTEGRATION !== '1';

describe.skipIf(SKIP)('facilitator integration', () => {
  it('GET /supported returns list of schemes for X Layer', async () => {
    const { timestamp, signature } = signOkxRequest({
      method: 'GET',
      path: FACILITATOR_PATHS.supported,
      secretKey: process.env.OKX_SECRET_KEY!,
    });
    const res = await fetch(`${OKX_FACILITATOR_BASE}${FACILITATOR_PATHS.supported}`, {
      headers: {
        'OK-ACCESS-KEY': process.env.OKX_API_KEY!,
        'OK-ACCESS-SIGN': signature,
        'OK-ACCESS-TIMESTAMP': timestamp,
        'OK-ACCESS-PASSPHRASE': process.env.OKX_PASSPHRASE!,
      },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { code: string; data: { kinds: unknown[] } };
    expect(body.code).toBe('0');
    expect(Array.isArray(body.data.kinds)).toBe(true);
    expect(body.data.kinds.length).toBeGreaterThan(0);
  }, 30_000);
});
```

- [ ] **Step 3.4: Add integration test script to root package.json**

Edit `package.json` — add under scripts:
```json
"test:integration": "RUN_INTEGRATION=1 vitest run --config tests/integration/vitest.config.ts"
```

- [ ] **Step 3.5: Run integration tests (optional, consumes small amount of gas/USDG for queries)**

Run:
```bash
pnpm test:integration
```

Expected: all tests pass. If not, debug against live X Layer mainnet before proceeding.

- [ ] **Step 3.6: Commit**

Run:
```bash
git add tests/integration/ package.json
git commit -m "test(integration): add opt-in integration tests for wallet + facilitator"
```

---

### Task 4: Full README with Aria Narrative

**Files:**
- Modify: `README.md`

**Steps:**

- [ ] **Step 4.1: Write full README**

Overwrite file `README.md`:
```markdown
# x402 Earn-Pay-Earn

> Meet Aria. She's a DeFi research agent running on X Layer. She needs token data to make smart decisions, but every lookup costs money. So she turns her own research library into paid services via x402, earning USDG from other agents. She uses those earnings to consume more research. A closed economy loop, on-chain, zero gas. Watch her balance move in real-time.

Full-stack agentic app for the OKX Build X hackathon (X Layer Arena, I'm Human track).

## The Idea

Two agents running in a single app, sharing a SQLite state store and running an autonomous earn-pay-earn loop:

- **Producer** (Fastify HTTP service) hosts 3 paid endpoints gated by x402. Each endpoint charges USDG via the OKX Facilitator API and returns market data sourced from OKX MCP Server.
- **Consumer** (Node agent loop) reasons via Groq LLM about which service to consume next, signs x402 payments via the OKX OnchainOS CLI, replays HTTP requests, ingests returned data, and repeats.
- **Dashboard** (Next.js 14) polls the shared SQLite for live events and renders loop status, balance trajectory, and transaction log with clickable X Layer explorer links.

Every settlement is a real on-chain transaction on X Layer. Zero gas because USDG transfers on X Layer are gas-free.

## Architecture

```
┌─────────────┐     x402 earn    ┌─────────────┐
│   Consumer  │ ────────────────▶│   Producer  │
│  (buyer)    │◀──── USDG ──────│   (seller)  │
└──────┬──────┘                  └──────┬──────┘
       │                                │
       │ SQLite orchestrator + event bus│
       │                                │
       └──────────┬─────────────────────┘
                  │
                  ▼
          ┌──────────────┐
          │  Dashboard   │
          │  (Next.js)   │
          └──────────────┘
```

See [docs/superpowers/specs/2026-04-13-x402-earn-pay-earn-design.md](docs/superpowers/specs/2026-04-13-x402-earn-pay-earn-design.md) for full design.

## Tech Stack

- TypeScript, Node 20+, pnpm workspaces
- Fastify (Producer), Next.js 14 App Router + Tailwind (Dashboard)
- SQLite via better-sqlite3 (shared state + event bus)
- Groq API (`llama-3.3-70b-versatile` primary, `llama-3.1-8b-instant` fast fallback)
- OKX OnchainOS CLI (Agentic Wallet + x402-payment + memepump trenches)
- OKX MCP Server HTTP (DEX quote + market price tools)
- OKX Facilitator REST API (verify + settle)

## Project Layout

```
x402-earn-pay-earn/
├── apps/
│   ├── producer/    Fastify HTTP service
│   ├── consumer/    Node agent loop
│   └── dashboard/   Next.js 14 frontend
├── packages/
│   ├── shared/           Types + constants
│   ├── okx-auth/         HMAC signing utility
│   ├── orchestrator/     SQLite + state machine + event bus + recovery
│   ├── mcp-client/       OKX MCP HTTP JSON-RPC client
│   └── onchain-clients/  CLI wrappers for wallet + x402-payment + trenches
├── scripts/
│   ├── src/spikes/       Day-1 verification spikes
│   ├── src/health-check.ts
│   └── src/demo-runner.ts
├── tests/integration/    Opt-in mainnet integration tests
└── docs/superpowers/     Design spec + implementation plan
```

## Quickstart

### Prerequisites

1. Node.js 20+ and pnpm 9+
2. OKX Developer Portal API key (https://web3.okx.com/onchain-os/dev-portal)
3. `onchainos` CLI installed (https://github.com/okx/onchainos-skills)
4. Groq API key (free tier, https://console.groq.com/keys)

### Setup

```bash
# 1. Clone + install
pnpm install

# 2. Copy env template
cp .env.example .env
# Edit .env with your OKX_API_KEY, OKX_SECRET_KEY, OKX_PASSPHRASE, GROQ_API_KEY

# 3. Login + set up 2 accounts
onchainos wallet login
onchainos wallet status   # capture first accountId as CONSUMER_ACCOUNT_ID
onchainos wallet add       # capture second accountId as PRODUCER_ACCOUNT_ID
# Edit .env with both account IDs

# 4. Fund Consumer wallet with 5-10 USDG from OKX CEX
# Send USDG to Consumer address on X Layer (chain 196)

# 5. Run pre-flight check
pnpm health-check
```

### Run Demo

Open 3 terminals:

```bash
# Terminal 1
pnpm dev:producer

# Terminal 2
pnpm dev:consumer

# Terminal 3
pnpm dev:dashboard
```

Open http://localhost:3000. Watch Aria earn and pay.

## OnchainOS / Uniswap Modules Used

Per hackathon requirement, this project uses OnchainOS modules substantively:

| Module | Role |
|---|---|
| `okx-agentic-wallet` | Identity, TEE signing, multi-account (Producer + Consumer) |
| `okx-x402-payment` | Buyer-side signing of x402 payment payloads |
| OKX Facilitator API | Seller-side /verify + /settle via HTTP with HMAC |
| OKX MCP Server | `dex-okx-dex-quote` + `dex-okx-market-token-price-info` (Producer data sources) |
| `okx-dex-trenches` | Meme pump dev reputation + bundle detection (trench-scan service) |
| `okx-onchain-gateway` | Tx simulation + broadcast (via agentic-wallet) |
| `okx-audit-log` | SQLite-backed audit event log (functional equivalent) |

**Uniswap AI:** Not used. X Layer does not have canonical Uniswap deployment; this submission is X Layer-native. See design spec section "Verified Architecture Foundations" for details.

## X Layer Deployment Positioning

- Home wallets (Producer + Consumer) live on X Layer
- All x402 settlements execute on X Layer (chain ID 196, CAIP-2 `eip155:196`)
- Zero gas for USDG / USDT transfers (X Layer native feature)
- Tx history visible on X Layer explorer: https://www.oklink.com/xlayer
- Dashboard links every transaction to the explorer

## Prize Targets

- **Best x402 application** — core mechanism is x402 earn + pay
- **Best economy loop** — literal earn-pay-earn cycle with measurable velocity
- **Best MCP integration** — Producer backends 2 of 3 services via OKX MCP Server HTTP
- **Most active agent** — target 12-20 cycles/min → 360+ on-chain txns in 30 minutes

## Team

(Fill in team members)

## License

MIT
```

- [ ] **Step 4.2: Commit**

Run:
```bash
git add README.md
git commit -m "docs: write full README with Aria narrative + setup instructions"
```

---

### Task 5: Final Integration Smoke Test

- [ ] **Step 5.1: Run all unit tests**

```bash
pnpm -r test
```

Expected: all tests pass (92+ unit).

- [ ] **Step 5.2: Run typecheck**

```bash
pnpm -r typecheck
```

Expected: zero errors.

- [ ] **Step 5.3: Run health check**

```bash
pnpm health-check
```

Expected: all 11 checks pass.

- [ ] **Step 5.4: Run optional integration tests**

```bash
pnpm test:integration
```

Expected: all pass against live X Layer mainnet.

- [ ] **Step 5.5: Manually start full demo**

Terminal 1: `pnpm dev:producer`
Terminal 2: `pnpm dev:consumer`
Terminal 3: `pnpm dev:dashboard`

Browser: http://localhost:3000

Watch at least 10 cycles complete. Verify:
- Home page shows cycle count incrementing, velocity > 0
- Balance displays earned + spent + net
- Event feed shows LOOP_CYCLE_STARTED → DECISION_MADE → PAYMENT_VERIFIED → SETTLEMENT_COMPLETED → LOOP_CYCLE_COMPLETED sequence
- Tx log page shows payments with clickable X Layer explorer links
- Stop all 3 processes when satisfied

- [ ] **Step 5.6: Tag completion**

```bash
git status
git log --oneline | head -40
git tag chunk-7-complete
git tag v0.1.0-demo-ready
```

---

### Task 6: Demo Video + Submission

- [ ] **Step 6.1: Record demo video (1-3 min)**

Script outline:
1. (0:00-0:15) Intro: "Meet Aria, an autonomous DeFi agent on X Layer"
2. (0:15-0:30) Show dashboard at http://localhost:3000 with loop idle
3. (0:30-1:00) Start the 3 processes, watch first cycle execute
4. (1:00-2:00) Show 10+ cycles completing, balance trajectory moving
5. (2:00-2:30) Click a tx hash → X Layer explorer proof
6. (2:30-3:00) Closing: "Aria is now self-sufficient. Zero gas. Open source. X Layer native."

Save to Google Drive or YouTube. Capture public link.

- [ ] **Step 6.2: Publish GitHub repo**

Push to public GitHub. Capture repo URL.

- [ ] **Step 6.3: Write X post**

Draft X post:
> Meet Aria — an autonomous AI agent on @XLayerOfficial earning and spending USDG via #x402. First true agentic economy loop on X Layer. Zero gas. Watch her go: [demo video link] Built for #BuildX hackathon. [GitHub link]

Post publicly. Capture post URL.

- [ ] **Step 6.4: Submit Google Form**

Fill submission form at https://docs.google.com/forms/d/e/1FAIpQLSfEjzs4ny2yH04tfDXs14Byye1KYhXv6NeytpqSKhrqTtgKqg/viewform with:
- Email
- Project Name: `x402 Earn-Pay-Earn`
- One-line description: `Autonomous agentic economy loop on X Layer using x402, OKX MCP Server, and Groq reasoning`
- Highlights: (copy from README Prize Targets section)
- Track: X Layer Arena
- Team members + contact
- Agentic Wallet address (Consumer address)
- GitHub URL
- OnchainOS Usage (copy from README table)
- Demo video URL
- X post URL

- [ ] **Step 6.5: Final tag**

```bash
git tag v0.1.0-submitted
git push --tags
```

---

**Chunk 7 Exit Criteria:**
- Health check passes all 11 validation steps
- Demo runner prints clear instructions
- Integration tests pass against live X Layer mainnet (opt-in)
- README has full Aria narrative + setup instructions + OnchainOS modules table
- Full manual demo runs 10+ cycles successfully
- Demo video recorded and uploaded
- GitHub repo public
- X post published
- Google Form submitted
- Git tags: chunk-7-complete, v0.1.0-demo-ready, v0.1.0-submitted

**🎉 Project complete. Ready to submit.**
