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
+--------------+     x402 earn    +--------------+
|   Consumer   | ---------------> |   Producer   |
|   (buyer)    | <--- USDG -----  |   (seller)   |
+------+-------+                  +------+-------+
       |                                 |
       |  SQLite orchestrator + event bus|
       |                                 |
       +-----------------+---------------+
                         |
                         v
                 +---------------+
                 |   Dashboard   |
                 |   (Next.js)   |
                 +---------------+
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
│   ├── producer/        Fastify HTTP service
│   ├── consumer/        Node agent loop
│   └── dashboard/       Next.js 14 frontend
├── packages/
│   ├── shared/          Types + constants
│   ├── okx-auth/        HMAC signing utility
│   ├── orchestrator/    SQLite + state machine + event bus + recovery
│   ├── mcp-client/      OKX MCP HTTP JSON-RPC client
│   └── onchain-clients/ CLI wrappers for wallet + x402-payment + trenches
├── scripts/
│   ├── src/spikes/      Day-1 verification spikes
│   ├── src/health-check.ts
│   └── src/demo-runner.ts
├── tests/integration/   Opt-in mainnet integration tests
└── docs/superpowers/    Design spec + implementation plan
```

## Quickstart

### Prerequisites

1. Node.js 20+ and pnpm 9+
2. OKX Developer Portal API key (https://web3.okx.com/onchain-os/dev-portal)
3. `onchainos` CLI installed (https://github.com/okx/onchainos-skills)
4. Groq API key (free tier, https://console.groq.com/keys)
5. If you are on an ISP that TLS-intercepts `web3.okx.com` (Telkomsel Internet Baik filter, for example), a VPN such as Cloudflare WARP

### Setup

```bash
# 1. Clone + install
pnpm install

# 2. Copy env template
cp .env.example .env
# Edit .env with OKX_API_KEY, OKX_SECRET_KEY, OKX_PASSPHRASE, GROQ_API_KEY

# 3. Login (AK login, non-interactive) + set up 2 accounts
onchainos wallet login                # uses OKX_API_KEY from env
onchainos wallet add                  # creates Account 2 (Producer)
onchainos wallet status               # copy Account 1 id -> CONSUMER_ACCOUNT_ID
onchainos wallet switch <producer-id> # copy address -> PRODUCER_ADDRESS
# Edit .env with CONSUMER_ACCOUNT_ID, PRODUCER_ACCOUNT_ID, PRODUCER_ADDRESS

# 4. Fund Consumer wallet with 5-10 USDG from OKX CEX
# Send USDG to Consumer EVM address on X Layer (chain 196)

# 5. Run pre-flight check
pnpm health-check
```

### Run Demo

Open 3 terminals:

```bash
# Terminal 1
pnpm dev:producer

# Terminal 2
pnpm --filter consumer start

# Terminal 3
pnpm dev:dashboard
```

Open http://localhost:3000. Watch Aria earn and pay.

## Testing

```bash
pnpm -r typecheck           # all workspaces
pnpm -r test                # all unit tests
pnpm test:integration       # opt-in, hits live X Layer mainnet
```

## OnchainOS Modules Used

Per hackathon requirement, this project uses OnchainOS modules substantively:

| Module | Role |
|---|---|
| `okx-agentic-wallet` | Identity, TEE signing, multi-account (Producer + Consumer) |
| `okx-x402-payment` | Buyer-side signing of x402 payment payloads |
| OKX Facilitator API | Seller-side /verify + /settle via HTTP with HMAC |
| OKX MCP Server | `dex-okx-dex-quote` + `dex-okx-market-token-price-info` (Producer data sources) |
| `okx-dex-trenches` | Meme pump dev reputation + bundle detection (trench-scan service) |

**Uniswap AI:** Not used. X Layer does not have canonical Uniswap deployment; this submission is X Layer-native. See design spec section "Verified Architecture Foundations" for details.

## X Layer Deployment Positioning

- Home wallets (Producer + Consumer) live on X Layer
- All x402 settlements execute on X Layer (chain ID 196, CAIP-2 `eip155:196`)
- Zero gas for USDG / USDT transfers (X Layer native feature)
- Tx history visible on X Layer explorer: https://www.oklink.com/xlayer
- Dashboard links every transaction to the explorer

## Prize Targets

- **Best x402 application** - core mechanism is x402 earn + pay
- **Best economy loop** - literal earn-pay-earn cycle with measurable velocity
- **Best MCP integration** - Producer backs 2 of 3 services via OKX MCP Server HTTP
- **Most active agent** - target 12-20 cycles/min, 360+ on-chain txns in 30 minutes

## Team

(Fill in team members before submission)

## License

MIT
