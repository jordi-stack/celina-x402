# Celina - x402 Earn-Pay-Earn

An autonomous agentic economy loop on X Layer. Celina is a DeFi research agent who sells token research and uses the income to buy more research. Every transaction is a real x402 payment settled on X Layer chain 196. Zero gas because USDG transfers on X Layer cost nothing.

Built for the OKX Build X hackathon, X Layer Arena track (I'm Human subcategory).

## Project Intro

The hackathon prompt asked for real agentic apps on X Layer that use OnchainOS. Most submissions pick one side of the x402 protocol: either an agent that pays, or a service that charges. Celina does both inside the same project, in a single closed loop.

- Celina runs on two separate X Layer accounts owned by one OKX Agentic Wallet login.
- Account 1 (Consumer) holds USDG and spends it to consume paid data services.
- Account 2 (Producer) hosts those services behind x402 paywalls and collects USDG.
- A Groq-powered reasoner picks which service to call next based on recent earnings, recent spends, and minimum balance rules.
- A Next.js dashboard reads the shared SQLite database and streams every state transition to the browser in real time.

The loop is the product. You fund Celina once with a few USDG, press play, and the app runs cycles forever without any manual signing. Every settlement produces a clickable X Layer explorer link in the dashboard.

## Agents and Onchain Identity

Celina's onchain identity is an **OKX Agentic Wallet**, created through the `onchainos wallet` CLI under a single AK (API key) login. One wallet login owns two X Layer accounts, and each account is assigned a distinct agent role inside the application.

| Agent       | Account ID (Agentic Wallet)              | X Layer address                                | Role                                                                                             |
|-------------|-------------------------------------------|--------------------------------------------------|--------------------------------------------------------------------------------------------------|
| Consumer    | `c90a20ab-d544-47e6-b227-0c259e0db291`   | `0x5fa0f8f77b47ea1ca48d8c9ed8560a130ad64e25`   | Runs the Celina reasoning loop. Holds USDG, reads balance each cycle, signs x402 payment proofs, replays the HTTP request, ingests the returned data. |
| Producer    | `a782c10a-0678-4164-8419-2085797410d6`   | `0xdfe57c7775f09599d12d11370a0afcb27f6aadbc`   | Hosts 3 paid services behind x402 paywalls. Receives settled USDG into this account. Does not run an autonomous loop; it is a reactive HTTP server.   |

Why two agents under one wallet? The x402 protocol requires a buyer and a seller at distinct addresses. Running both roles under one Agentic Wallet (rather than two separate logins) makes the project cleaner:

- One set of credentials in `.env`, not two.
- Switching roles is a single CLI call (`onchainos wallet switch <account-id>`) rather than a full logout and login cycle.
- Both accounts share the same TEE-backed signing policy, so if the judges want to review the policy for either agent the path is identical.
- Producer and Consumer can be audited as a single economic unit on OKLink: filter by either address and the counterpart shows up on every transaction.

The Consumer is the only agent with autonomous behavior. The Producer reacts to HTTP requests, verifies payment proofs via the Facilitator, delivers data, and settles. Neither role ever holds a private key in application memory. Every signature goes through the `onchainos` CLI, which keeps keys inside the Agentic Wallet's TEE.

## Architecture Overview

```
           +--------------------+         +--------------------+
           |  Consumer process  |         |  Producer process  |
           |  (Node, Celina)    |         |  (Fastify, port    |
           |                    |         |   3001)            |
           +---------+----------+         +----------+---------+
                     |                               |
                     |   1. POST /v1/<service>       |
                     |------------------------------>|
                     |                               |
                     |   2. 402 Challenge header     |
                     |<------------------------------|
                     |                               |
          3. sign via onchainos x402-payment CLI     |
                     |                               |
                     |   4. Replay with signature    |
                     |------------------------------>|
                     |                               |
                     |        +------------+   5. verify
                     |        | Facilitator|<---------|
                     |        |  HMAC REST |          |
                     |        +------------+          |
                     |                               |
                     |   6. 200 + MCP data payload   |
                     |<------------------------------|
                     |                               |
                     |        +------------+   7. settle
                     |        | Facilitator|<---------|
                     |        |  HMAC REST |          |
                     |        +------------+          |
                     |                               |
            +--------+-------------------------------+--------+
            |              Shared SQLite database              |
            |            <repo>/data/app.db (WAL)              |
            +--------+-----------------------------------------+
                     |
                     |   8. SSE stream of state changes
                     v
              +---------------+
              | Dashboard     |
              | Next.js 14    |
              | port 3000     |
              +---------------+
```

All three processes resolve `data/app.db` to the same absolute path via `import.meta.url`, so Producer writes (`insertPendingPayment`, `updateSettlement`) are visible to Consumer (`findPaymentByNonce` polling) and to the Dashboard (`useSseEvents` hook) without any IPC layer. SQLite runs in WAL mode for concurrent reads.

The Consumer loop is driven by a pure-function state machine in `packages/orchestrator/src/state/machine.ts` with 9 states and 19 transitions:

```
IDLE -> DECIDING -> SIGNING -> REPLAYING -> VERIFYING -> SETTLING -> COMPLETED
                                 |                                     |
                                 v                                     v
                               FAILED ----RETRY----> prev state     IDLE (next cycle)
                                 |
                                 v
                              HALTED (resumable)
```

### Monorepo layout

```
x402-earn-pay-earn/
  apps/
    producer/         Fastify service, x402-gate Fastify plugin, 3 paid routes
    consumer/         Celina loop, Groq reasoner, budget tracker, model throttler
    dashboard/        Next.js 14 App Router, SSE /api/events, / and /tx pages
  packages/
    shared/           TypeScript types, constants, Zod schemas for MCP + x402
    okx-auth/         HMAC-SHA256 signer for Facilitator REST auth
    orchestrator/     SQLite store, event bus, state machine, boot reconciler
    mcp-client/       OKX MCP JSON-RPC client with envelope unwrapping
    onchain-clients/  Typed wrappers for onchainos CLI (wallet, x402-payment, trenches)
  scripts/
    src/health-check.ts    14-step pre-flight validation
    src/demo-runner.ts     Terminal bootstrap runner
    src/spikes/            Day-1 verification spikes (kept for reference)
  tests/integration/       Opt-in tests hitting live X Layer mainnet (RUN_INTEGRATION=1)
  data/                    SQLite database lives here (gitignored)
  .env                     All 16 env vars (gitignored)
```

## Deployment Addresses

Celina does not deploy a custom smart contract. The app pays in USDG, which is a native X Layer stablecoin issued at a canonical address. The two accounts that run the loop were created via the OKX Agentic Wallet CLI under a single AK login.

| Role                | X Layer address                              |
|---------------------|----------------------------------------------|
| Consumer (buyer)    | `0x5fa0f8f77b47ea1ca48d8c9ed8560a130ad64e25` |
| Producer (seller)   | `0xdfe57c7775f09599d12d11370a0afcb27f6aadbc` |
| USDG token contract | `0x4ae46a509f6b1d9056937ba4500cb143933d2dc8` |
| USDT token contract | `0x779ded0c9e1022225f8e0630b35a9b54be713736` |

- Chain ID: `196`
- CAIP-2 identifier: `eip155:196`
- RPC URL: `https://rpc.xlayer.tech`
- Explorer: `https://www.oklink.com/xlayer`

To verify Celina is alive on-chain, look up either address on OKLink X Layer and filter for USDG token transfers. Every completed cycle produces exactly one `transferWithAuthorization` call signed by the Consumer and settled by the OKX Facilitator.

## OnchainOS and Uniswap Skill Usage

The hackathon requires substantive use of OnchainOS modules. Celina uses five of them. Uniswap AI is not used because X Layer does not have a canonical Uniswap deployment, so swap quoting runs through the OKX DEX aggregator via MCP instead.

| OnchainOS module        | How Celina uses it                                                                                                          | Code location                                                     |
|-------------------------|-----------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------|
| `okx-agentic-wallet`    | Single AK login creates two X Layer accounts (Consumer + Producer). Loop calls `wallet switch`, `wallet balance`, `wallet history` each cycle. | `packages/onchain-clients/src/wallet.ts`                          |
| `okx-x402-payment`      | Non-interactive CLI signs the `transferWithAuthorization` payload for each x402 challenge.                                  | `packages/onchain-clients/src/x402-payment.ts`                    |
| OKX Facilitator API     | Producer calls `/api/v6/pay/x402/verify` before delivering data and `/api/v6/pay/x402/settle` after, authenticated via HMAC-SHA256 with `OK-ACCESS-KEY`, `OK-ACCESS-SIGN`, `OK-ACCESS-TIMESTAMP`, `OK-ACCESS-PASSPHRASE` headers. | `packages/okx-auth/src/sign.ts`, `apps/producer/src/facilitator/client.ts` |
| OKX MCP Server          | Producer sources two of its three paid services from MCP tools `dex-okx-dex-quote` and `dex-okx-market-token-price-info` over JSON-RPC. The envelope `result.content[0].text` is parsed via a Zod generic helper. | `packages/mcp-client/src/client.ts`, `apps/producer/src/routes/`  |
| `okx-dex-trenches`      | Third paid service uses the trenches CLI for `token-dev-info` + `bundle-info` plus an in-app risk scoring function that combines rug pull count and sniper count. | `packages/onchain-clients/src/trenches.ts`, `apps/producer/src/routes/trench-scan.ts` |

Uniswap AI: deliberately not used. The design doc documents the reason: X Layer does not host a canonical Uniswap v2 or v3 deployment at the addresses the Uniswap AI skill expects. Trying to force that skill on X Layer would produce either chain-mismatched quotes or runtime errors. The OKX DEX aggregator covers the same use case natively on chain 196.

## Working Mechanics

The Consumer loop is in `apps/consumer/src/agent/loop.ts`. One full cycle runs like this:

**1. Cycle bookkeeping.** The loop increments `cycleNumber`, inserts a row into the `cycles` table, and transitions the state machine from `IDLE` to `DECIDING`. If the loop is retrying an existing cycle (because of a prior `HTTP_402`), the insert is skipped so the primary key stays unique.

**2. Balance read.** The loop calls `wallet switch` to the Consumer account, then `wallet balance --chain xlayer --token-address <USDG>` to get the current spendable amount. The onchainos CLI wraps every response in a `{ ok, data }` envelope, so `WalletClient.balance()` unwraps it before returning the raw on-chain figure.

**3. Reasoning.** The loop builds a state object (`balanceUsdg`, `recentEarnings`, `recentSpends`, `cycleNumber`, `minBalanceUsdg`) and sends it to Groq. The primary model is `llama-3.3-70b-versatile`. If Groq returns HTTP 429, the `ModelThrottler` downgrades to `llama-3.1-8b-instant` for the next cycle and reports back up once the rate limit clears. The LLM returns a JSON decision: either `consume_service` with a service name, or `skip` with a reason. Groq's free tier is enough to run the demo: the throttler absorbs rate limit hits automatically, so you never need paid credits to see the full loop.

**4. Challenge fetch.** For a `consume_service` decision, the loop sends `POST /v1/<service>` to the Producer with the canonical demo body. The Fastify `x402-gate` plugin has a `preHandler` hook that responds with HTTP 402 and a `PAYMENT-REQUIRED` header. The header is a base64-encoded `Challenge402` object with one `accepts` entry: scheme `exact`, network `eip155:196`, amount in USDG minimal units, payTo the Producer address, maxTimeoutSeconds 60.

**5. Signing.** The loop calls `X402PaymentClient.signPayment` which shells out to `onchainos payment x402-pay` with the accepts array. The CLI (v2.2.8) is non-interactive by design, so there is no retry or `--force` flag. It returns a `PaymentPayload` containing `authorization` (from, to, value, nonce, validBefore, validAfter) and a signature.

**6. Replay.** The loop re-sends the same HTTP request, this time with a `PAYMENT-SIGNATURE` header carrying the encoded proof. The Fastify `preHandler` decodes the header, calls the OKX Facilitator `/verify` endpoint with HMAC auth, checks `isValid`, and writes a pending row into the `payments` table before allowing the route handler to run. The route handler hits either the OKX MCP server or the trenches CLI and returns JSON.

**7. Settlement.** When the route handler finishes, Fastify's `onResponse` hook calls the Facilitator `/settle` endpoint with `syncSettle: true`. The Facilitator broadcasts the transfer on chain 196, waits for inclusion, and returns the transaction hash. The hook writes `tx_hash`, `settled_at`, and `status='settled'` into the same SQLite row.

**8. Consumer polling.** Back in the Consumer loop, right after the replay returns HTTP 200, `waitForSettlement` polls `payments` by nonce every 500 ms for up to 30 seconds. As soon as it sees `status='settled'` with a non-null `tx_hash`, it transitions the state machine `VERIFYING -> SETTLING -> COMPLETED` and emits `SERVICE_CONSUMED` + `LOOP_CYCLE_COMPLETED` events.

**9. Dashboard update.** The Dashboard `/api/events` SSE endpoint reads the same SQLite database and pushes each new event to the browser. The home page has three cards (balance, velocity, cycle log) and the `/tx` page lists every transaction hash with a clickable X Layer explorer link.

The three paid services:

| Service           | Route                | Price     | Data source                             |
|-------------------|----------------------|-----------|-----------------------------------------|
| `market-snapshot` | `POST /v1/market-snapshot` | 0.01 USDG (`10000` minimal units)  | OKX MCP `dex-okx-market-token-price-info` (batch `{items:[...]}`) |
| `swap-quote`      | `POST /v1/swap-quote`      | 0.015 USDG (`15000` minimal units) | OKX MCP `dex-okx-dex-quote`             |
| `trench-scan`     | `POST /v1/trench-scan`     | 0.02 USDG (`20000` minimal units)  | `okx-dex-trenches` CLI, dev + bundle info plus risk score |

Throttling: `ModelThrottler` downgrades Groq model on 429, steps back up on next success. `BudgetTracker` holds a rolling window of recent earnings and recent spends so the LLM has context. Retry: up to 3 replays per cycle on HTTP 402 mismatch, then the cycle is marked `FAILED`.

## Running It Locally

### Prerequisites

- Node 20 (pinned in `.nvmrc`, Node 24 breaks `better-sqlite3`)
- pnpm 9
- `onchainos` CLI v2.2.8 or newer (`curl -sSL https://raw.githubusercontent.com/okx/onchainos-skills/main/install.sh | sh`)
- OKX Developer Portal API key + secret + passphrase (https://web3.okx.com/onchain-os/dev-portal)
- Groq API key, free tier is sufficient for running the full demo (https://console.groq.com/keys). The free tier has rate limits on `llama-3.3-70b-versatile` but the in-app `ModelThrottler` auto-downgrades to `llama-3.1-8b-instant` on 429 responses, so the loop keeps running without paid credits.
- A VPN such as Cloudflare WARP if your ISP TLS-intercepts `web3.okx.com` (some Indonesian ISPs do)

### Setup

```bash
pnpm install

cp .env.example .env
# Fill OKX_API_KEY, OKX_SECRET_KEY, OKX_PASSPHRASE, GROQ_API_KEY

onchainos wallet login
onchainos wallet add                  # creates Account 2 for Producer
onchainos wallet status               # copy Account 1 id
onchainos wallet switch <producer-id> # copy address
# Fill CONSUMER_ACCOUNT_ID, PRODUCER_ACCOUNT_ID, PRODUCER_ADDRESS in .env

# Send 5 to 10 USDG to the Consumer X Layer address from OKX CEX
# or any X Layer wallet

pnpm health-check                     # must report 14/14 before demo
```

### Run the loop

Three terminals:

```bash
# Terminal 1
pnpm dev:producer

# Terminal 2
pnpm dev:consumer

# Terminal 3
pnpm dev:dashboard
```

Open http://localhost:3000 and watch Celina run.

### Tests

```bash
pnpm -r typecheck
pnpm -r test                 # 98 unit tests across 9 workspaces
pnpm test:integration        # opt-in, hits X Layer mainnet
```

## Team

- Member 1: [name] ([@handle])
- Member 2: [name] ([@handle])

(Replace before submission.)

## Project Positioning in the X Layer Ecosystem

X Layer is OKX's L2. The ecosystem needs three things to feel alive: real agents that move money on their own, visible on-chain activity, and apps that use the X Layer-native stablecoin rail instead of bridging tokens from other chains. Celina is shaped to score on all three.

- **Native USDG, zero-gas settlements.** Every cycle settles USDG via `transferWithAuthorization` on X Layer. USDG transfers on X Layer are gas-free, so Celina can run hundreds of cycles on tiny balances without ever touching OKB for fees. This is the cleanest demonstration of a property that only X Layer offers.
- **Visible agent traffic.** Target velocity is 12 to 20 cycles per minute. Over a 30-minute demo window that produces 360+ new settlements, all attributable to one running agent, all clickable in the OKLink explorer. This is the kind of continuous on-chain activity the ecosystem currently lacks outside of swap bots.
- **Loop, not link.** The dominant x402 demo pattern is "agent pays a service". Celina flips half of the loop back into the same process, so the ecosystem sees earn + spend in a single tx stream. The resulting economic pattern is closed: Celina does not need external funding after the first seed transfer.
- **OnchainOS-first, not bolted on.** Every external call goes through an OnchainOS module: wallet via Agentic Wallet CLI, payments via x402-payment CLI, data via MCP server, risk via trenches CLI. There is no direct RPC call, no manual transaction construction, no custom signer. If OnchainOS modules work, Celina works. If they break, Celina surfaces exactly which module broke via the health check.
- **Boring where it matters.** State is in SQLite, not Redis. The dashboard is server-rendered Next.js, not a Web3 wallet-connect dance. The LLM is Groq, not a local model. Every choice trades ambition for demo-day reliability. The judges should be able to fund a wallet, start three processes, and see an autonomous economy loop within two minutes.

## License

MIT
